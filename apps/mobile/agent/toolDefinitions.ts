export type JsonSchemaProperty = {
  type: "string" | "number" | "object" | "array";
  description?: string;
};

export type ToolInputSchema = {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
};

const stringProperty = (description?: string): JsonSchemaProperty => ({
  type: "string",
  ...(description ? { description } : {}),
});

const numberProperty = (description: string): JsonSchemaProperty => ({
  type: "number",
  description,
});

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: "save_personal_data",
    description:
      "Guarda o actualiza los datos personales del usuario. " +
      "Usa esta herramienta SIEMPRE que el usuario comparta informacion personal como nombre, edad, peso, altura, objetivos de fitness, lesiones, experiencia, etc. " +
      "El campo personal_data debe contener TODOS los datos personales conocidos del usuario como un array JSON completo, no solo los nuevos. " +
      "Cada elemento del array tiene: key (nombre del campo), description (para que sirve este campo), value (el valor). " +
      'Ejemplo: [{"key":"Nombre","description":"Nombre real del usuario","value":"Juan"}]',
    inputSchema: {
      type: "object",
      properties: {
        personal_data: stringProperty(
          "Array JSON completo con todos los datos personales. Cada objeto tiene key, description y value. " +
          'Ejemplo: [{"key":"Nombre","description":"Nombre real del usuario","value":"Juan"},{"key":"Objetivo","description":"Objetivo principal de fitness","value":"Ganar masa muscular"}]',
        ),
      },
      required: ["personal_data"],
    },
  },
  {
    name: "list_personal_data_keys",
    description:
      "Devuelve la lista de todos los campos (keys) guardados en la memoria personal del usuario. " +
      "Usa esta herramienta como primer paso para descubrir que datos hay guardados.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_field_description",
    description:
      "Lee la descripcion de un campo especifico de la memoria personal. " +
      "Recibe el key del campo y devuelve su description, que explica para que sirve ese campo. " +
      "Usa esta herramienta para identificar en que campo esta la informacion que buscas.",
    inputSchema: {
      type: "object",
      properties: {
        key: stringProperty("El key (nombre) del campo cuya descripcion quieres leer"),
      },
      required: ["key"],
    },
  },
  {
    name: "read_field_value",
    description:
      "Lee el valor de un campo especifico de la memoria personal. " +
      "Recibe el key del campo y devuelve su value. " +
      "Usa esta herramienta una vez que hayas identificado el campo correcto mediante su description.",
    inputSchema: {
      type: "object",
      properties: {
        key: stringProperty("El key (nombre) del campo cuyo valor quieres leer"),
      },
      required: ["key"],
    },
  },
  {
    name: "read_measurement",
    description:
      "Lee las medidas corporales del usuario para una fecha específica. " +
      "Devuelve el registro de medidas de ese día (peso, contornos, altura) si existe, o un mensaje indicando que no hay registro. " +
      "Usa esta herramienta cuando el usuario pregunte por sus medidas de un día concreto.",
    inputSchema: {
      type: "object",
      properties: {
        date: stringProperty("Fecha en formato YYYY-MM-DD (por ejemplo: 2026-03-30)"),
      },
      required: ["date"],
    },
  },
  {
    name: "write_measurement",
    description:
      "Guarda o actualiza las medidas corporales del usuario para una fecha específica. " +
      "Usa esta herramienta cuando el usuario te diga sus medidas (peso, contornos, altura). " +
      "Solo incluye en el JSON los campos que el usuario proporcione; los demás se mantendrán como null.",
    inputSchema: {
      type: "object",
      properties: {
        date: stringProperty("Fecha en formato YYYY-MM-DD (por ejemplo: 2026-03-30)"),
        data: stringProperty(
          "JSON con las medidas a guardar. Campos posibles: weight_kg, body_fat_pct, neck_cm, chest_cm, waist_cm, hips_cm, biceps_cm, quadriceps_cm, calf_cm, height_cm. " +
          'Ejemplo: {"weight_kg": 75.5, "body_fat_pct": 18.5, "waist_cm": 82}',
        ),
      },
      required: ["date", "data"],
    },
  },
  {
    name: "read_meal_foods",
    description:
      "Lee los alimentos registrados en una comida específica de una fecha. " +
      "Usa esta herramienta cuando el usuario pregunte qué ha comido, los alimentos de una comida, o quiera revisar su dieta.",
    inputSchema: {
      type: "object",
      properties: {
        date: stringProperty("Fecha en formato YYYY-MM-DD (por ejemplo: 2026-04-11)"),
        meal: stringProperty("Nombre de la comida: Desayuno, Almuerzo, Comida, Merienda o Cena"),
      },
      required: ["date", "meal"],
    },
  },
  {
    name: "search_foods",
    description:
      "Busca alimentos en la base de datos local. Soporta búsqueda por nombre, categoría, tipo (alimento/producto_comercial/receta), " +
      "filtros por rango de calorías/proteínas/carbohidratos/grasa por 100g, y ordenación. Todos los parámetros son opcionales, combínalos según lo que pida el usuario.",
    inputSchema: {
      type: "object",
      properties: {
        query: stringProperty("Texto de búsqueda por nombre (opcional)"),
        category: stringProperty("Filtrar por categoría del alimento, por ejemplo: grasa, proteina, carbohidrato, fruta, verdura, lacteo, cereal (opcional)"),
        source: stringProperty("Filtrar por tipo: 'alimento', 'producto_comercial', 'receta' o 'personal' (opcional)"),
        min_calories: numberProperty("Calorías mínimas por 100g (opcional)"),
        max_calories: numberProperty("Calorías máximas por 100g (opcional)"),
        min_protein: numberProperty("Proteínas mínimas por 100g en gramos (opcional)"),
        max_protein: numberProperty("Proteínas máximas por 100g en gramos (opcional)"),
        min_carbs: numberProperty("Carbohidratos mínimos por 100g en gramos (opcional)"),
        max_carbs: numberProperty("Carbohidratos máximos por 100g en gramos (opcional)"),
        min_fat: numberProperty("Grasa mínima por 100g en gramos (opcional)"),
        max_fat: numberProperty("Grasa máxima por 100g en gramos (opcional)"),
        sort_by: stringProperty("Ordenar por: 'calories_asc', 'calories_desc', 'protein_asc', 'protein_desc', 'carbs_asc', 'carbs_desc', 'fat_asc', 'fat_desc' (opcional)"),
      },
    },
  },
  {
    name: "add_meal_food",
    description:
      "Añade un alimento a una comida del usuario en una fecha específica. " +
      "IMPORTANTE: Antes de usar esta herramienta DEBES haber buscado el alimento con search_foods. " +
      "Pasa los datos nutricionales exactos obtenidos de la búsqueda.",
    inputSchema: {
      type: "object",
      properties: {
        date: stringProperty("Fecha en formato YYYY-MM-DD (por ejemplo: 2026-04-11)"),
        meal: stringProperty("Nombre de la comida: Desayuno, Almuerzo, Comida, Merienda o Cena"),
        data: stringProperty(
          "JSON con los datos del alimento. Campos requeridos: name (string), grams (number), calories_kcal (number), protein_g (number), carbs_g (number), fat_g (number). " +
          'Ejemplo: {"name": "Arroz blanco", "grams": 150, "calories_kcal": 195, "protein_g": 4.1, "carbs_g": 43.4, "fat_g": 0.4}',
        ),
      },
      required: ["date", "meal", "data"],
    },
  },
  {
    name: "search_exercises",
    description:
      "Busca ejercicios en la base de datos local. Soporta búsqueda por nombre, músculo principal, músculos secundarios, equipamiento y dificultad. " +
      "Todos los parámetros son opcionales y combinables.",
    inputSchema: {
      type: "object",
      properties: {
        query: stringProperty("Texto de búsqueda por nombre del ejercicio (opcional)"),
        muscle_group: stringProperty("Filtrar por músculo principal, por ejemplo: pecho, espalda, piernas, hombros, biceps, triceps, core, gluteos (opcional)"),
        secondary_muscle: stringProperty("Filtrar por músculo secundario (opcional)"),
        equipment: stringProperty("Filtrar por equipamiento, por ejemplo: mancuernas, barra, máquina, cable, peso corporal, kettlebell, banda elástica (opcional)"),
        difficulty: stringProperty("Filtrar por dificultad: principiante, intermedio, avanzado (opcional)"),
      },
    },
  },
  {
    name: "read_routines",
    description:
      "Lee las rutinas de entrenamiento del usuario. Devuelve todas las rutinas con sus ejercicios, series, repeticiones, peso y descanso. " +
      "Usa esta herramienta cuando el usuario pregunte por sus rutinas, entrenamientos, o quiera revisar sus ejercicios programados.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_routine",
    description:
      "Crea una nueva rutina de entrenamiento. IMPORTANTE: Antes de usar esta herramienta DEBES haber buscado los ejercicios con search_exercises " +
      "para obtener los nombres exactos de la base de datos. Pasa el JSON con los datos de la rutina.",
    inputSchema: {
      type: "object",
      properties: {
        data: stringProperty(
          'JSON con los datos de la rutina. Campos: name (string, nombre de la rutina), category (string: "strength", "hypertrophy", "cardio" o "flexibility"), ' +
          'icon (string: "activity", "heart", "zap", "target", "wind", "shield", "compass", "crosshair", "award", "star", "sun", "moon", "sliders" o "trending-up"), ' +
          "exercises (array de objetos con: name (string, nombre exacto del ejercicio de search_exercises), muscle (string, músculo principal), " +
          'series (array de objetos con: type (string: "normal", "warmup", "failure", "amrap", "partial", "negative", "forced", "tempo", "isometric", "dropset", "restpause", "myoreps", "cluster", "superset"), ' +
          'reps (string, número de repeticiones), weight_kg (string, peso en kg), rest_seconds (string, descanso en segundos))). Ejemplo: {"name": "Push Day", "category": "hypertrophy", "icon": "zap", "exercises": [{"name": "Press banca con barra", "muscle": "pecho", "series": [{"type": "normal", "reps": "10", "weight_kg": "60", "rest_seconds": "90"}]}]}',
        ),
      },
      required: ["data"],
    },
  },
  {
    name: "create_feature_issue",
    description:
      "Envía al equipo de Gymnasia una solicitud de mejora del usuario. " +
      "ANTES de llamarla, muestra al usuario el título y el resumen exactos que vas a enviar y espera a que los apruebe; " +
      "si pide cambios, reescríbelos y vuelve a preguntar. No la llames sin esa aprobación. " +
      "No copies frases literales de la conversación: redacta un resumen propio y neutro, sin datos personales. " +
      "No afirmes nunca que la solicitud existe hasta que esta herramienta te devuelva un número de referencia.",
    inputSchema: {
      type: "object",
      properties: {
        title: stringProperty(
          "Título corto y descriptivo de la mejora, en español, sin prefijos ni etiquetas.",
        ),
        summary: stringProperty(
          "Resumen propio en español de lo que quiere el usuario. Sin citas literales ni datos personales.",
        ),
      },
      required: ["title", "summary"],
    },
  },
];

export const AGENT_TOOL_NAMES = AGENT_TOOL_DEFINITIONS.map((tool) => tool.name);

export const CHAT_TOOLS = {
  openai: AGENT_TOOL_DEFINITIONS.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  })),
  anthropic: AGENT_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  })),
  google: [{
    functionDeclarations: AGENT_TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    })),
  }],
};

export type ToolInputValidation = {
  valid: boolean;
  errors: string[];
};

export function validateToolInput(
  schema: ToolInputSchema,
  input: unknown,
): ToolInputValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["El argumento debe ser un objeto."] };
  }

  const values = input as Record<string, unknown>;
  for (const field of schema.required ?? []) {
    if (!(field in values) || values[field] === null || values[field] === undefined) {
      errors.push(`Falta el campo requerido "${field}".`);
    }
  }

  for (const [field, value] of Object.entries(values)) {
    const property = schema.properties[field];
    if (!property || value === null || value === undefined) continue;
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== property.type) {
      errors.push(`El campo "${field}" debe ser de tipo ${property.type}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
