# co源码解析

## co的作用：
* 把generator包装成promise
* 实现generator的自动执行。自动使用同步的方式执行异步代码。
* 把yield后promise的resolve值赋值给yield左边的变量。并把generator里return的值传给promise的then回调里。


## co的原理：
* 从外部看，co把generator包裹成一个promise，当generator执行完成时，也就是这个promise变成fulfill状态，会执行这个promise的then回调，并把generator里的return的值传入这个then回调。
* 从内部看，co把generator中yield后面的表达式都包裹成promise。在promise的then回调里，执行下一个promise(也就是下一个yield)，直至所有的promise执行完。


## co包裹的generator里，有表达式是generator的情况
* 如果yield后面是一个generator，则前面既可以使用yield，也可以使用yield*。并且，这个generator里yield后面的表达式，必须是函数、promise、生成器、遍历器对象、数组、对象之一。
* 如果使用yield，则后面既可以是生成器函数，也可以是遍历器对象，在toPromise的环节，co会递归处理这个generator；
* 如果使用yield*，则后面跟着的只能是遍历器对象，generator自身特性会把yield*后面跟着的generator里的yield展开，co会把展开的yield和其它yield平行处理。


## co和co.wrap的使用场景
* co是立即执行，无参数；
* co.wrap是将生成器包裹成返回promise的函数，调用这个函数才执行，并且这个函数是可以传参的。

## yield后面的表达式是对象或数组的使用场景
* 并发执行对象或数组里面的promise
* 其实这种并发的实现，co也是基于promise.all()的。

## co把generator转成promise后，当fulfill时，传入then回调里的值是哪来的？
* 从使用者的角度看，在generator里return的值，就是then回调里传入的值；
* 从内部实现看，遍历器对象最后一次next返回对象的Value字段的值是generator最后return的值，也是then回调里传入的值。


## co包裹的generator中的yield后面跟的表达式必须是promise、function、生成器、遍历器对象、数组、对象之一


## yield后的表达式执行完成后，如何把结果赋值给左边的变量？
* 首先，yield表达式是没有返回值的，或者说它的返回值是undefined。
* co将yield后的promise resolve的值，在下一次调用next时，传入next中，遍历器把本次next传入的值作为上次yield的返回值。


## co错误处理机制
参考：http://taobaofed.org/blog/2016/03/18/error-handling-in-koa/
* 遍历器对象throw方法，可以在外部抛出，在生成器内部捕获；
* 如果co包裹的generator内部有try catch，则co内部发生错误时，会被这个try catch捕获；
* generator里有几个yield，为避免某一个yield后的promise rejected，不影响到主流程的执行，可以对每一个yield的执行过程try catch；
* 如果generator内部没有try catch，则co包裹成的promise变为rejected状态，执行co的catch回调。
