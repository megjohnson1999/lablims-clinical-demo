// Middleware to check user roles

module.exports = function(roles) {
  return function(req, res, next) {
    // Get user from auth middleware
    const user = req.user;
    
    // Check if user has required role
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ msg: 'Access denied: insufficient permissions' });
    }
    
    next();
  };
};
