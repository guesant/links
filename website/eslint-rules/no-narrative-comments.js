const toolDirectivePattern =
  /^(?:eslint-(?:disable|enable)(?:-(?:line|next-line))?|@ts-(?:expect-error|ignore|nocheck)|prettier-ignore|istanbul\s+ignore|c8\s+ignore|v8\s+ignore|jscpd:ignore-(?:start|end)|nosemgrep|semgrep:)(?:\b|:|\s)/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow narrative comments in Svelte components',
    },
    schema: [],
    messages: {
      narrative:
        'Narrative comments are not allowed; use tool directives only.',
    },
  },
  create(context) {
    const checkComment = (value, loc) => {
      if (!toolDirectivePattern.test(value.trim())) {
        context.report({
          loc,
          messageId: 'narrative',
        });
      }
    };

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          checkComment(comment.value, comment.loc);
        }
      },
      SvelteHTMLComment(node) {
        checkComment(node.value, node.loc);
      },
    };
  },
};
