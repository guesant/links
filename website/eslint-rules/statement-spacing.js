import stylistic from '@stylistic/eslint-plugin';

const paddingRule = stylistic.rules['padding-line-between-statements'];

export default {
  rules: {
    'padding-line-between-statements': {
      ...paddingRule,
      create(context) {
        const listeners = paddingRule.create(context);

        return {
          ...listeners,
          SvelteScriptElement(node) {
            listeners.BlockStatement(node);

            for (const statement of node.body) {
              listeners[':statement']({
                ...statement,
                parent: {
                  type: 'Program',
                  body: node.body,
                },
              });
            }
          },
          'SvelteScriptElement:exit'(node) {
            listeners['BlockStatement:exit'](node);
          },
        };
      },
    },
  },
};
