// Simple string templating helper using double curly braces.
export function renderTemplate(template, variables) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key];
    }
    return match;
  });
}
