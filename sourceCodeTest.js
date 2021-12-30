import './index.css';

// _tracker1           ##函数表达式
const test0 = function () {

}

// _tracker2          ##箭头函数
const test1 = () => {

}

// _tracker&_trackerParam={id: 'xxx', value: 'zzz'}     ##向埋点方法传参
const test2 = () => {

}

const test3 = () => {
  this._trackerParam = {   // ##自己组装埋点参数
    id: 'xxx',
    value: 'zzz'
  }
}

// ## 函数内部的方法埋点
function test4 () {
  // _tracker4
  const test4_0 = () => {

  }

  // _tracker5
  function test4_1 () {

  }
}

// ## class内部的方法埋点
class bbb {
  // _tracker6
  constructor() {

  }

  // _tracker7
  test5 = () => {

  }

  // _tracker8
  test6 = function () {

  }
}
