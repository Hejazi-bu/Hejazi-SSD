export const cleanText = (text: string): string => {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "")
    .map(line => line.replace(/\s+/g, " "))
    .join("\n");
};
