import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { deploymentStatus, resolveRun, writeCiOutputs } from './ci-policy.mjs';
import { requireWebsite } from './paths.cjs';

const { parse } = requireWebsite('yaml');

const typescript = requireWebsite('typescript');

const sha = '1'.repeat(40);

const newer = '2'.repeat(40);

const workflow = parse(await readFile('.github/workflows/ci.yml', 'utf8'));

function evaluate(expression, context = {}) {
  return runInNewContext(
    expression.replace(/^\s*\$\{\{([\s\S]*)\}\}\s*$/, '$1'),
    {
      cancelled: () => {
        return false;
      },
      ...context,
    },
  );
}

function needsFor(plan, result = 'skipped', outputs = {}) {
  return {
    plan: {
      result: 'success',
      outputs: Object.fromEntries(
        Object.entries(plan).map(
          ([
            key,
            value,
          ]) => {
            return [
              key,
              String(value),
            ];
          },
        ),
      ),
    },
    statistics: {
      result,
      outputs,
    },
  };
}

for (const scenario of [
  {
    eventName: 'push',
    operation: 'publish',
    publish: true,
  },
  {
    eventName: 'pull_request',
    operation: 'validate',
    publish: false,
  },
  {
    eventName: 'schedule',
    operation: 'statistics',
    publish: true,
  },
  ...[
    'validate',
    'audit',
    'publish',
    'statistics',
  ].map((operation) => {
    return {
      eventName: 'workflow_dispatch',
      operation,
      publish: [
        'publish',
        'statistics',
      ].includes(operation),
    };
  }),
]) {
  test(`CI selects ${scenario.operation} for ${scenario.eventName}`, () => {
    const plan = resolveRun({
      ...scenario,
      ref: 'refs/heads/main',
      sha,
    });

    assert.equal(plan.operation, scenario.operation);
    assert.equal(plan.publish, scenario.publish);
    assert.equal(plan.update_statistics, scenario.operation === 'statistics');
    assert.equal(plan.source_sha, sha);
  });
}

test('manual publication and statistics reject other branches before any write', () => {
  for (const operation of [
    'publish',
    'statistics',
  ]) {
    assert.throws(() => {
      resolveRun({
        eventName: 'workflow_dispatch',
        ref: 'refs/heads/topic',
        sha,
        operation,
      });
    }, /main branch/);
  }

  for (const operation of [
    'validate',
    'audit',
  ]) {
    assert.equal(
      resolveRun({
        eventName: 'workflow_dispatch',
        ref: 'refs/heads/topic',
        sha,
        operation,
      }).operation,
      operation,
    );
  }

  assert.equal(
    resolveRun({
      eventName: 'workflow_dispatch',
      ref: 'refs/heads/topic',
      sha,
    }).operation,
    'validate',
  );
  assert.throws(() => {
    resolveRun({
      eventName: 'workflow_run',
      sha,
    });
  }, /Unsupported/);
  assert.throws(() => {
    resolveRun({
      eventName: 'workflow_dispatch',
      operation: 'unknown',
      sha,
    });
  }, /Unsupported/);
  assert.throws(() => {
    resolveRun({
      eventName: 'pull_request',
      sha: 'bad',
    });
  }, /SHA/);
});

test('build handles skipped statistics while blocking failures and unchanged snapshots', () => {
  const push = resolveRun({
    eventName: 'push',
    ref: 'refs/heads/main',
    sha,
  });

  const statistics = resolveRun({
    eventName: 'schedule',
    ref: 'refs/heads/main',
    sha,
  });

  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: needsFor(push),
    }),
    true,
  );
  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: needsFor(statistics, 'success', {
        changed: 'true',
        sha: newer,
      }),
    }),
    true,
  );

  for (const result of [
    'failure',
    'cancelled',
    'skipped',
  ]) {
    assert.equal(
      evaluate(workflow.jobs.build.if, {
        needs: needsFor(statistics, result),
      }),
      false,
    );
  }

  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: needsFor(statistics, 'success', {
        changed: 'false',
      }),
    }),
    false,
  );

  const failedPlan = needsFor(push);

  failedPlan.plan.result = 'failure';
  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: failedPlan,
    }),
    false,
  );
  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: needsFor(push),
      cancelled: () => {
        return true;
      },
    }),
    false,
  );
});

test('only successful publications reach deployment, never PRs or manual audits', () => {
  for (const operation of [
    'validate',
    'audit',
    'publish',
    'statistics',
  ]) {
    const plan = resolveRun({
      eventName: 'workflow_dispatch',
      operation,
      ref: 'refs/heads/main',
      sha,
    });

    const needs = {
      ...needsFor(plan),
      build: {
        result: 'success',
        outputs: {
          source_sha: newer,
        },
      },
    };

    const context = {
      needs,
      github: {
        ref: 'refs/heads/main',
      },
    };

    assert.equal(evaluate(workflow.jobs.deploy.if, context), plan.publish);

    for (const result of [
      'failure',
      'cancelled',
      'skipped',
    ]) {
      needs.build.result = result;
      assert.equal(evaluate(workflow.jobs.deploy.if, context), false);
    }
  }

  const audit = resolveRun({
    eventName: 'workflow_dispatch',
    operation: 'audit',
    ref: 'refs/heads/main',
    sha,
  });

  assert.equal(
    evaluate(workflow.jobs.build.if, {
      needs: needsFor(audit),
    }),
    false,
  );
  assert.equal(
    evaluate(workflow.jobs.audit.if, {
      needs: needsFor(audit),
      github: {
        event_name: 'workflow_dispatch',
      },
    }),
    true,
  );
  assert.equal(
    evaluate(workflow.jobs.audit.if, {
      needs: needsFor(audit),
      github: {
        event_name: 'push',
      },
    }),
    false,
  );
});

test('built snapshot and artifact metadata use the statistics commit instead of the triggering SHA', () => {
  const plan = resolveRun({
    eventName: 'schedule',
    ref: 'refs/heads/main',
    sha,
  });

  const needs = needsFor(plan, 'success', {
    changed: 'true',
    sha: newer,
  });

  const checkout = workflow.jobs.build.steps[0];

  assert.equal(
    evaluate(checkout.with.ref, {
      needs,
    }),
    newer,
  );
  assert.equal(
    evaluate(checkout.with.ref, {
      needs: needsFor(plan),
    }),
    sha,
  );

  const deployment = workflow.jobs.deploy.steps.find((step) => {
    return step.id === 'deployment';
  });

  const buildStep = workflow.jobs.build.steps.find((step) => {
    return step.with?.runCmd;
  });

  assert.equal(
    evaluate(buildStep.env.LOBBY_SOURCE_SHA, {
      steps: {
        source: {
          outputs: {
            sha: newer,
          },
        },
      },
    }),
    newer,
  );
  assert.ok(buildStep.with.env.includes('LOBBY_SOURCE_SHA'));
  assert.equal(
    evaluate(deployment.if, {
      steps: {
        freshness: {
          outputs: {
            current: 'false',
          },
        },
      },
    }),
    false,
  );
});

test('build stamps the effective SHA even when GitHub preserves the original event SHA', async () => {
  const text = await readFile('.config/scripts/tasks.mjs', 'utf8');

  const source = typescript.createSourceFile(
    'tasks.mjs',
    text,
    typescript.ScriptTarget.Latest,
    true,
  );

  const statement = source.statements.find((node) => {
    return (
      typescript.isVariableStatement(node) &&
      node.declarationList.declarations[0].name.text === 'build'
    );
  });

  let metadata;

  const build = runInNewContext(
    `(${statement.declarationList.declarations[0].initializer.getText(source)})`,
    {
      syncFederation: async () => {},
      command: async (name, args, env) => {
        if (name === 'npm') {
          metadata = env;
        }
      },
      resolve,
      config: {
        site: {
          repository: 'guesant/lobby',
        },
      },
      process: {
        env: {
          GITHUB_SHA: sha,
          LOBBY_SOURCE_SHA: newer,
        },
      },
    },
  );

  await build();
  assert.equal(metadata.GITHUB_SHA, newer);
});

test('freshness verification rejects failures and skips obsolete artifacts', async () => {
  for (const current of [
    sha,
    newer,
  ]) {
    const result = await deploymentStatus({
      sha,
      repository: 'guesant/lobby',
      token: 'workflow-token',
      fetcher: async (url, options) => {
        assert.equal(
          url,
          'https://api.github.com/repos/guesant/lobby/git/ref/heads/main',
        );
        assert.equal(options.redirect, 'error');

        return Response.json({
          object: {
            sha: current,
          },
        });
      },
    });

    assert.equal(result.current, current === sha);
  }

  for (const response of [
    new Response(null, {
      status: 403,
    }),
    Response.json({
      object: {},
    }),
  ]) {
    await assert.rejects(
      deploymentStatus({
        sha,
        repository: 'guesant/lobby',
        token: 'workflow-token',
        fetcher: async () => {
          return response;
        },
      }),
    );
  }

  await assert.rejects(
    deploymentStatus({
      sha,
      repository: 'untrusted/../../path',
      token: 'workflow-token',
    }),
    /repository/,
  );
});

test('CI outputs carry the effective SHA and explain unchanged or obsolete operations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lobby-ci-output-'));

  try {
    const env = {
      CI_OUTPUT_PATH: join(directory, 'output'),
      CI_SUMMARY_PATH: join(directory, 'summary'),
    };

    await writeCiOutputs(
      {
        changed: false,
        sha,
      },
      'Statistics unchanged.',
      env,
    );
    assert.equal(
      await readFile(env.CI_OUTPUT_PATH, 'utf8'),
      `changed=false\nsha=${sha}\n`,
    );
    assert.equal(
      await readFile(env.CI_SUMMARY_PATH, 'utf8'),
      'Statistics unchanged.\n',
    );
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

test('one workflow owns all events and keeps write permissions isolated', async () => {
  assert.deepEqual(await readdir('.github/workflows'), [
    'ci.yml',
  ]);
  assert.equal(workflow.on.schedule[0].cron, '0 3 * * *');
  assert.equal(
    workflow.on.workflow_dispatch.inputs.operation.default,
    'validate',
  );
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.statistics.permissions.contents, 'write');
  assert.equal(workflow.jobs.deploy.permissions.pages, 'write');
  assert.equal(JSON.stringify(workflow).includes('"actions":"write"'), false);
  assert.equal(JSON.stringify(workflow).includes('workflow_run'), false);
});

test('statistics writes require a trusted main event independently of plan outputs', () => {
  for (const eventName of [
    'pull_request',
    'push',
    'schedule',
    'workflow_dispatch',
  ]) {
    for (const ref of [
      'refs/heads/main',
      'refs/heads/topic',
    ]) {
      const allowed =
        ref === 'refs/heads/main' &&
        [
          'schedule',
          'workflow_dispatch',
        ].includes(eventName);

      assert.equal(
        evaluate(workflow.jobs.statistics.if, {
          github: {
            event_name: eventName,
            ref,
          },
          inputs: {
            operation: 'statistics',
          },
          needs: {
            plan: {
              outputs: {
                update_statistics: 'true',
              },
            },
          },
        }),
        allowed,
      );
    }
  }
});

test('publication operations share a non-cancelling concurrency group while PRs cancel older checks', () => {
  const groups = [];

  for (const scenario of [
    {
      event_name: 'push',
    },
    {
      event_name: 'schedule',
    },
    {
      event_name: 'workflow_dispatch',
      operation: 'publish',
    },
    {
      event_name: 'workflow_dispatch',
      operation: 'statistics',
    },
  ]) {
    const context = {
      github: {
        ...scenario,
        ref: 'refs/heads/main',
        event: {},
      },
      inputs: {
        operation: scenario.operation,
      },
      format: (template, ...values) => {
        return template.replace(/\{(\d+)\}/g, (_, index) => {
          return values[index];
        });
      },
    };

    groups.push(
      workflow.concurrency.group.replace(
        /\$\{\{([\s\S]*?)\}\}/g,
        (_, expression) => {
          return evaluate(expression, context);
        },
      ),
    );
    assert.equal(
      evaluate(workflow.concurrency['cancel-in-progress'], context),
      false,
    );
  }

  assert.equal(new Set(groups).size, 1);
  assert.equal(
    evaluate(workflow.concurrency['cancel-in-progress'], {
      github: {
        event_name: 'pull_request',
      },
      inputs: {},
    }),
    true,
  );
});

test('fast CI excludes heavy scanners and stops before build when validation fails', async () => {
  const sourceText = await readFile('.config/scripts/tasks.mjs', 'utf8');

  const source = typescript.createSourceFile(
    'tasks.mjs',
    sourceText,
    typescript.ScriptTarget.Latest,
    true,
  );

  const fast = source.statements.find((node) => {
    return node.name?.text === 'checkFast';
  });

  const full = source.statements.find((node) => {
    return node.name?.text === 'check';
  });

  const calls = [];

  const fastCheck = runInNewContext(`(${fast.getText(source)})`, {
    command: async (name) => {
      calls.push(name);
    },
    secretScan: async () => {
      calls.push('gitleaks');
    },
    tests: async () => {
      calls.push('tests');
    },
  });

  await fastCheck();
  assert.ok(calls.includes('gitleaks'));
  assert.ok(calls.includes('tests'));
  assert.match(full.getText(source), /await security\(\)/);

  let ci;

  function visit(node) {
    if (typescript.isCaseClause(node) && node.expression.text === 'ci') {
      ci = node.statements
        .filter((statement) => {
          return !typescript.isBreakStatement(statement);
        })
        .map((statement) => {
          return statement.getText(source);
        })
        .join('\n');
    }

    typescript.forEachChild(node, visit);
  }

  visit(source);

  const failing = runInNewContext(`(async () => { ${ci} })`, {
    checkFast: async () => {
      throw new Error('validation failed');
    },
    build: async () => {
      assert.fail('build cannot run after failed validation');
    },
  });

  await assert.rejects(failing(), /validation failed/);

  const failingBuild = runInNewContext(`(async () => { ${ci} })`, {
    checkFast: async () => {},
    build: async () => {
      throw new Error('build failed');
    },
  });

  await assert.rejects(failingBuild(), /build failed/);
});
