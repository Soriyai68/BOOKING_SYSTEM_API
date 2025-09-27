const { Role } = require("../data");

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).send({error: "Authentication required."});
    }

    if (req.user.role === Role.SUPERADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).send({error: "You do not have permission to access this resource"});
    }

    next();
  };
}
module.exports = authorize
