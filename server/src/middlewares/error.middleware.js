import logger from '../utils/logger.util.js';
import { AppError } from '../utils/errors.util.js';

const handleCastErrorDB = err => {
  return new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
};

const handleDuplicateFieldsDB = err => {
  // Extract duplicate value safely
  const match = err.message ? err.message.match(/(["'])(\\?.)*?\1/) : null;
  const value = match ? match[0] : 'field';
  return new AppError(`Duplicate field value: ${value}. Please use another value!`, 409);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  return new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, req, res) => {
  logger.error(`Error Dev: ${err.message}`, { stack: err.stack });
  res.status(err.statusCode || 500).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, req, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error('ERROR Prod 💥', err);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong on the server',
    });
  }
};

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.code = err.code;

    // Direct object cloning does not preserve prototype names, check raw err too
    const name = err.name || error.name;
    const code = err.code || error.code;

    if (name === 'CastError') error = handleCastErrorDB(err);
    if (code === 11000) error = handleDuplicateFieldsDB(err);
    if (name === 'ValidationError') error = handleValidationErrorDB(err);
    if (name === 'JsonWebTokenError') error = handleJWTError();
    if (name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
