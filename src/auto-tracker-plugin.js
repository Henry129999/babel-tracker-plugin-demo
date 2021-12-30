const { declare } = require('@babel/helper-plugin-utils');
const { addDefault } = require('@babel/helper-module-imports'); // 引入模块插件

const TACKER_FUNC_NAME = '_tracker';
const TRACKER_IMP_NAME = 'tracker';
const TRACKER_PARAM_NAME = '_trackerParam';

/**
 * 判断注释是否命中，并将命中注释中的 trackerParam 内容部分提取出来
 * .e.g _trackerParam={id: 'xxx', value: 'zzz'}
 * @param trackerComment {string} 待解析埋点参数的注释
 */
const getTrackerParam = (trackerComment = '') => {
  const isIncludeTrackerComment = trackerComment.includes(TRACKER_PARAM_NAME);
  if (isIncludeTrackerComment) {
    const leftTag = trackerComment.indexOf('{');
    const rightTag = trackerComment.indexOf('}');
    if (leftTag !== -1 && rightTag !== -1 ) {
      const paramString = trackerComment.substring(leftTag, rightTag + 1);
      return paramString;
    }
  }

  return '';
}

/**
 * 生成 tracker 方法，插入到目标函数path节点中去
 * @param path {object} 当前 AST 节点
 * @param state {object} 当前文件上下文中的全局变量
 * @param api {object} babel提供的工具集合api
 * @param trackerComment {string} 命中的注释内容
 */
const addTrackerFuncNode = (path, state, api, trackerComment) => {
  const bodyPath = path.get('body');
  const trackerParam = getTrackerParam(trackerComment);
  const trackerAST = api.template.statement(`${state.trackerName}(${trackerParam})`)();

  if (bodyPath.isBlockStatement()) {
    bodyPath.node.body.unshift(trackerAST);
  } else {
    // 箭头函数没有函数体，加入了埋点方法后，需要包裹一层后返回
    const ast = api.template.statement(
      `{${state.trackerName}(${trackerParam});return PREV_BODY;}`
    )({PREV_BODY: bodyPath.node});

    bodyPath.replaceWith(ast);
  }
}

/**
 * 检查注释中是否有 _tracker，如果有，则将注释返回
 * @param leadingComments {Array} 注释集合
 * @return string|undefined
 */
const getTrackerCommon = (leadingComments = []) => {
  const trackerCommon = leadingComments.find(item => item.value.includes(TACKER_FUNC_NAME));
  return trackerCommon && trackerCommon.value;
}


const autoTrackPlugin = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "plugin-tracker",
    visitor: {
      Program: {
        enter(path, state) {
          // 检索所有的注释comments，看是否有埋点注释
          const isHasTrackerComments = !!path.container.comments.find(
            item => item.value.includes(TACKER_FUNC_NAME)
          );

          if (isHasTrackerComments) {
            state.isHasTrackerComments = isHasTrackerComments;
            state.trackerName = TACKER_FUNC_NAME;

            // 遍历头部import，看是否已经导入tracker模块
            let hadImportTracker = false;
            path.traverse({
              ImportDeclaration (curPath) {
                const requirePath = curPath.get('source').node.value;
                if (requirePath === options.trackerPath) {
                  hadImportTracker = true;
                }
              }
            });
            if (!hadImportTracker) {
              addDefault(path, TRACKER_IMP_NAME, { nameHint: TRACKER_IMP_NAME });
            }
          } else {
            state.hasTrackerComments = false;
          }
        },

        exit(path, state) {
          if (!state.isHasTrackerComments && state.hasThisTrackerParam) {
            addDefault(path, TRACKER_IMP_NAME, { nameHint: TRACKER_IMP_NAME });
          }
        }
      },

      /**
       * 检查所有的 类方法 | 箭头函数表达式 | 函数表达式 | 函数声明
       * 查看函数表达式前是否有打点的注释，如果有，则将注释提取出来
       */
      'ClassMethod|ArrowFunctionExpression|FunctionExpression|FunctionDeclaration'(path, state) {
        // 该文件内没有打点注释，终止后续遍历
        if (state.isHasTrackerComments) {
          const Comments = path.node && path.node.leadingComments;
          let trackerComment = getTrackerCommon(Comments);

          // 普通的函数声明 和 class 中的函数声明
          if (trackerComment) {
            addTrackerFuncNode(path, state, api, trackerComment);
          } else {
            // 处理class中的箭头函数 .e.g () => {}
            const parent = path.parent || {};
            if (parent.type === 'ClassProperty') {
              trackerComment = parent.leadingComments
                && getTrackerCommon(parent.leadingComments)
            }

            // 处理带变量声明的箭头函数 .e.g const cc = () => {}
            const parentNode = path.parentPath || {};
            if (parentNode.type === 'VariableDeclarator') {
              const ppNode = parentNode.parentPath || {};
              trackerComment = ppNode.node
                && ppNode.node.leadingComments
                && getTrackerCommon(ppNode.node.leadingComments);
            }

            if (trackerComment) {
              addTrackerFuncNode(path, state, api, trackerComment);
            }
          }
        }
      },

      /**
       * 查看函数内部是否有 this._trackerParam 的对象，如果有，则在下方添加打点方法，并传入该对象
       * 查找 this._trackerParam = {} 赋值表达式
       */
      'AssignmentExpression'(path, state) {
        const leftNode = path.node.left;
        if (leftNode.type === 'MemberExpression'
          && leftNode.object
          && leftNode.object.type === 'ThisExpression'
          && leftNode.property.type === 'Identifier'
          && leftNode.property.name === TRACKER_PARAM_NAME
        ) {
          state.hasThisTrackerParam = true;
          const trackerAST = api.template.statement(`${TACKER_FUNC_NAME}(this.${TRACKER_PARAM_NAME})`)();
          path.insertAfter(trackerAST);
        }
      }
    }
  }
});

module.exports = autoTrackPlugin;
