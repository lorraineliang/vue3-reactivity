const isObject = value => value !== null && typeof value === 'object'
const convert = target => isObject(target) ? reactive(target) : target
const hasOwn = (target, key) => target.hasOwnProperty(key)

export function reactive(target) {
  // 1.reactive函数接收一个对象，如果不是对象直接返回，是则返回proxy对象
  if (!isObject(target)) return target
  // 2.创建拦截器对象handler 设置get/set/deleteProperty
  const handler = {
    get(target, key, receiver) {
      // 收集依赖
      track(target, key)
      const result = Reflect.get(target, key, receiver)
      return convert(result)
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver)
      let result = true
      if (oldValue !== value) { // 如果新值跟旧值一样则不需要重新赋值
        result = Reflect.set(target, key, value, receiver)
        // 触发更新
        trigger(target, key)
      }
      return result

    },
    deleteProperty(target, key) {
      const hasKey = hasOwn(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (hasKey && result) { // 如果对象存在这个属性并且能删除成功则触发更新
        // 触发更新
        trigger(target, key)
      }
      return result
    }
  }
  // 3.返回proxy对象
  return new Proxy(target, handler)
}

let activeEffect = null
export function effect(callback) { // watch/watchEffect 的核心是 effect函数
  activeEffect = callback
  callback() // 初始化先执行一次 函数中访问响应式对象属性，去收集依赖  依赖--》浅显理解为项目中用到此响应式对象的地方
  activeEffect = null
}

// targetMap -> depsMap -> dep 递归找依赖
let targetMap = new WeakMap() // WeakMap只接收对象作为键名
export function track(target, key) {
  if (!activeEffect) return //activeEffect为空则项目中不存在因为调用某个值而需要收集的依赖
  let depsMap = targetMap.get(target) // 以target为键的对象
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key) // 依赖数组
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  dep.add(activeEffect) // 收集依赖
}

export function trigger(target, key) {
  const depsMap = targetMap.get(target) // 找到目标对象对应的属性 如obj.a obj为目标对象 a为属性
  if (!depsMap) return // 找不到属性 意味着没有需要触发更新的属性 直接返回
  const dep = depsMap.get(key) // 找到需要触发更新的依赖数组
  if (dep) {
    dep.forEach(effect => {
      effect() // 把数组中存放的函数执行 存放位置在dep.add(activeEffect) activeEffect是callback
    })
  }
}

export function ref(raw) {
  if (isObject(raw) && raw.__v_isRef) return // 判断是否是ref对象 是则返回
  let value = convert(raw) // 转换成响应式对象
  let r = {
    __v_isRef: true,
    get value() {
      track(r, 'value')
      return value
    },
    set value(newValue) {
      if (newValue !== value) {
        raw = newValue
        value = convert(raw)
        trigger(r, 'value')
      }
    }
  }
  return r
}

export function toRefs(proxy) {
  const ret = proxy instanceof Array ? new Array(proxy.length) : {}
  for (const key in proxy) {
    ret[key] = toProxyRef(proxy, key)
  }
  return ret
}

function toProxyRef(proxy, key) {
  let r = {
    __v_isRef: true,
    get value() {
      return proxy[key] // 不需要收集依赖或派发更新，因为传入refs方法的入参本身就是响应式对象，对象本身具有这个功能
    },
    set value(newValue) {
      proxy[key] = newValue
    }
  }
  return r
}

export function computed(getter) {
  const result = ref() // 不传参ref会返回undefined
  effect(() => (result.value = getter())) // effect会监听getter函数中的响应式数据
  return result
}