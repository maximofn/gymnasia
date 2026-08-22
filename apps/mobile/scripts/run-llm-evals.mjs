const message = [
  "Las evals con LLM no forman parte de la suite determinista.",
  "La interfaz sanitaria está versionada en policy/health-safety/llm-evaluation.json",
  "y siempre produce informes con authorizing=false.",
  "Se ejecutarán desde LangSmith (alcance local/CI, sin instrumentar la app móvil)",
  "cuando GYM-77/78 implementen el juez y el dataset de la épica de observabilidad.",
].join("\n");

console.log(message);
