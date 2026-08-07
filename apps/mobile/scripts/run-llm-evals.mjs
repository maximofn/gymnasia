const message = [
  "Las evals con LLM no forman parte de la suite determinista.",
  "Se ejecutarán desde LangSmith (alcance local/CI, sin instrumentar la app móvil)",
  "cuando exista el dataset de la épica de observabilidad.",
].join("\n");

console.log(message);
