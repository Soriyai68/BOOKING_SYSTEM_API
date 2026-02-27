const { Role } = require("../data");

function authorize(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user || req.customer;
    if (!user) {
      return res.status(401).send({ error: "Authentication required." });
    }

    const userRole = user.role || (req.customer ? Role.CUSTOMER : null);

    if (userRole === Role.SUPERADMIN) {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).send({
        error: "You do not have permission to access this resource",
      });
    }

    next();
  };
}
module.exports = authorize;
