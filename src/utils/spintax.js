export function renderSpintax(input = '') {
  let text = String(input ?? '');
  const pattern = /\{([^{}]+)\}/;
  while (pattern.test(text)) {
    text = text.replace(pattern, (_, segment) => {
      const options = segment.split('|').map((part) => part.trim());
      if (!options.length) {
        return segment;
      }
      const choice = options[Math.floor(Math.random() * options.length)];
      return renderSpintax(choice);
    });
  }
  return text;
}
