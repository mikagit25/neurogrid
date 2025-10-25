/**
 * Response Helper Utility
 */
class ResponseHelper {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res, message = 'Error occurred', statusCode = 500, details = null) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(details && { details })
    });
  }

  static validation(res, errors) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: message
    });
  }

  static forbidden(res, message = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: message
    });
  }

  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({
      success: false,
      error: message
    });
  }
}

module.exports = { ResponseHelper };
