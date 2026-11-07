/**
 * Standard API and Controller Response Utility
 */

class ApiResponse {
  static success(res, message, data = {}, statusCode = 200) {
    if (res.format && typeof res.format === 'function') {
      return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message, statusCode = 400, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ApiResponse;

