exports.error = require('./error.middleware')
exports.validator = require('./validator.middleware')
exports.authenticate = require('./auth.middleware')
exports.authorize = require('./authorize.middleware')
exports.corsOptions = require('./cors.middleware')
exports.sanitize = require('./sanitize.middleware')
exports.morgan = require('./morgan.middleware')

const permissionMiddleware = require('./permission.middleware')
exports.requirePermission = permissionMiddleware.requirePermission
exports.loadUserPermissions = permissionMiddleware.loadUserPermissions
exports.hasPermission = permissionMiddleware.hasPermission
