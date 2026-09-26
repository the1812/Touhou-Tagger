const onePerFile = {
  meta: {
    messages: { extraComponent: 'Each file may define only one Vue component.' },
  },
  create(context) {
    let count = 0

    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !['defineComponent', 'defineAsyncComponent'].includes(node.callee.name)
        ) {
          return
        }
        count++
        if (count > 1) {
          context.report({ node, messageId: 'extraComponent' })
        }
      },
    }
  },
}

export default {
  meta: { name: 'vue-components' },
  rules: { 'one-per-file': onePerFile },
}
