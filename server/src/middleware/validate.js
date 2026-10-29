export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.safeParse(dataToValidate);

      if (!parsed.success) {
        const errorMessages = parsed.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        );
        return res.status(400).json({
          message: 'Validation error',
          errors: errorMessages
        });
      }

      // Assign parsed/sanitized data back
      req[source] = parsed.data;
      next();
    } catch (err) {
      next(err);
    }
  };
};
