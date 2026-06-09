// Structured logger matching pino's call signature.
// Swap this file for pino if you add it as a dependency — callers don't change.
function fmt(level, obj, msg) {
  const isStr = typeof obj === 'string'
  const body = isStr ? { msg: obj } : { ...obj, ...(msg != null ? { msg } : {}) }
  return JSON.stringify({ level, time: new Date().toISOString(), ...body })
}

const log = {
  info: (obj, msg) => console.log(fmt('info', obj, msg)),
  warn: (obj, msg) => console.warn(fmt('warn', obj, msg)),
  error: (obj, msg) => console.error(fmt('error', obj, msg)),
  child: (bindings) => ({
    info: (obj, msg) =>
      log.info(typeof obj === 'string' ? { ...bindings, msg: obj } : { ...bindings, ...obj }, msg),
    warn: (obj, msg) =>
      log.warn(typeof obj === 'string' ? { ...bindings, msg: obj } : { ...bindings, ...obj }, msg),
    error: (obj, msg) =>
      log.error(typeof obj === 'string' ? { ...bindings, msg: obj } : { ...bindings, ...obj }, msg),
  }),
}

export default log
