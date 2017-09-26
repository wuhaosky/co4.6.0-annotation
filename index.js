
/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

co.wrap = function (fn) {
  createPromise.__generatorFunction__ = fn;
  return createPromise;
  function createPromise() {
    return co.call(this, fn.apply(this, arguments));
  }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 * 执行生成器函数，并返回一个promise，then传入的值为生成器最后一个状态返回的值
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

function co(gen) {
  var ctx = this;
  var args = slice.call(arguments, 1); // 将arguments转换成数组

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  // 将yield后面跟的任何表达式都包裹成promise
  return new Promise(function(resolve, reject) {
    if (typeof gen === 'function') gen = gen.apply(ctx, args);      // 执行构造器函数，并将构造器函数的this指向ctx，返回遍历器对象。现在的gen不再是构造器函数，而是遍历器对象。
    if (!gen || typeof gen.next !== 'function') return resolve(gen);

    onFulfilled();  // 遍历器对象执行第一次next方法
    /** 遍历器对象自动执行next方法的实现
     * @param {Mixed} res
     * @return {Promise}
     * @api private
     */

    function onFulfilled(res) {
      var ret;
      try {
        ret = gen.next(res);  // 遍历器对象执行next方法，返回一个对象，形如{done: Boolean, value: yield后面的表达式}
      } catch (e) {
        return reject(e);
      }
      next(ret);              // 将yield后面跟的表达式都包裹为promise，并执行这个promise，
                              // 当这个promise状态变为fulfill时执行onFulfilled函数，
                              // 并传入resolve的值，于是遍历器就会自动执行
      return null;
    }

    /**
     * @param {Error} err
     * @return {Promise}
     * @api private
     */

    function onRejected(err) {
      var ret;
      try {
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     * 将yield后面跟的表达式都包裹为promise，并执行这个promise，
     * 当这个promise状态变为fulfill时执行onFulfilled函数，
     * 并传入resolve的值，于是遍历器就会自动执行
     * @param {Object} ret
     * @return {Promise}
     * @api private
     */

    function next(ret) {
      if (ret.done) return resolve(ret.value);   // 遍历器遍历完成，也就是生成器执行完成，也就是co返回的那个promise的状态变成fulfill，并返回生成器函数最后一个状态的值
      var value = toPromise.call(ctx, ret.value); // 将yield后面跟的表达式都包裹为promise
      if (value && isPromise(value)) return value.then(onFulfilled, onRejected);  // 执行这个promise，当这个promise状态变为fulfill时执行onFulfilled函数，并传入resolve的值
      return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '  // 如果yield后面的表达式不是 function，promise，generator，array，object 之一的话，会抛出类型错误
        + 'but the following object was passed: "' + String(ret.value) + '"'));
    }
  });
}

/**
 * Convert a `yield`ed value into a promise.
 * 将yield后面跟的表达式都包裹为promise
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

function toPromise(obj) {
  if (!obj) return obj;
  if (isPromise(obj)) return obj;
  if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
  if ('function' == typeof obj) return thunkToPromise.call(this, obj);
  if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
  if (isObject(obj)) return objectToPromise.call(this, obj);
  return obj;
}

/**
 * Convert a thunk to a promise.
 * 将函数包裹成promise，需要在函数内传入一个回调函数，这个回调函数有两个参数，1.err 2.res
 * @param {Function}
 * @return {Promise}
 * @api private
 */

function thunkToPromise(fn) {
  var ctx = this;
  return new Promise(function (resolve, reject) {
    fn.call(ctx, function (err, res) {
      if (err) return reject(err);
      if (arguments.length > 2) res = slice.call(arguments, 1);
      resolve(res);
    });
  });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 * 将可yieldables的数组使用Promise.all()方式包裹成promise，可yieldables就是指的类型为function，promise，generator，array，object 之一
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

function arrayToPromise(obj) {
  // 数组中的元素都包裹成promise，然后使用Promise.all返回数组的promise
  return Promise.all(obj.map(toPromise, this));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 * 将可yieldables的对象使用Promise.all()方式包裹成promise
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

function objectToPromise(obj){
  // 对象中的元素都包裹成promise，然后使用Promise.all返回对象的promise
  var results = new obj.constructor();
  var keys = Object.keys(obj);
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var promise = toPromise.call(this, obj[key]);
    if (promise && isPromise(promise)) defer(promise, key);
    else results[key] = obj[key];
  }
  return Promise.all(promises).then(function () {
    return results;
  });

  function defer(promise, key) {
    // predefine the key in the result
    results[key] = undefined;
    promises.push(promise.then(function (res) {
      results[key] = res;
    }));
  }
}

/**
 * Check if `obj` is a promise.
 * 判断obj是不是promise
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  // 根据对象是不是有then函数
  return 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 * 判断obj是不是遍历器对象
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  // 根据对象是不是有next和throw函数
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 * 判断obj是不是生成器函数
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */
 
function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  // 根据构造器的名字是不是“GeneratorFunction”
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.  
 * 判断val是不是对象
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  // 根据对象的构造器引用是不是指向Object
  return Object == val.constructor;
}
