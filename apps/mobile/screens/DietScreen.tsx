import { memo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Animated, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CatalogStatusNotice } from "../catalogs/CatalogStatusNotice";
import { foodCatalogImageUri } from "../catalogs/sources";
import type { FoodCatalogEntry } from "../catalogs/types";
import type { DietScreenActions, DietScreenModel } from "../controllers/dietController";
import type { DietMealCategory } from "../diet/nutritionContract";
import { dateFromISO, formatNutritionNumber } from "../diet/model";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

export const DietHeader = memo(function DietHeader({
  model,
  actions,
  scrollY,
}: {
  model: Readonly<DietScreenModel>;
  actions: Readonly<DietScreenActions>;
  scrollY: Animated.Value;
}) {
  return (
    <View
      onLayout={(event) => actions.captureHeaderHeight(event.nativeEvent.layout.height)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: mobileTheme.spacing[4], paddingTop: 4, paddingBottom: 8, backgroundColor: mobileTheme.color.bgApp, overflow: "hidden" }}
    >
      <Animated.View style={{
        opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
        maxHeight: scrollY.interpolate({ inputRange: [0, 70], outputRange: [200, 0], extrapolate: "clamp" }),
        transform: [{ translateY: scrollY.interpolate({ inputRange: [0, 70], outputRange: [0, -20], extrapolate: "clamp" }) }],
      }}>
        <View style={{ gap: 8 }}>
          <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => actions.changeDay(-1)} style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
              <Feather name="chevron-left" size={20} color={mobileTheme.color.textSecondary} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 15, fontWeight: "700" }}>{model.dateLabel}</Text>
              <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700" }}>{model.dateContextLabel}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable onPress={() => actions.changeDay(1)} style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
                <Feather name="chevron-right" size={20} color={mobileTheme.color.textSecondary} />
              </Pressable>
              <Pressable testID="diet-date-picker-toggle" onPress={actions.toggleDatePicker} style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="calendar-outline" size={18} color={mobileTheme.color.textSecondary} />
              </Pressable>
            </View>
          </View>
          {model.datePickerOpen ? (
            model.isWeb ? (
              <TextInput
                testID={shellSurfaceTestId("diet-date-picker")}
                value={model.selectedDate}
                onChangeText={actions.changeWebDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={mobileTheme.color.textSecondary}
                style={{ minHeight: 44, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: 12, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, fontSize: 14 }}
              />
            ) : (
              <View testID={shellSurfaceTestId("diet-date-picker")} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgSurface, padding: 8, gap: 8 }}>
                <DateTimePicker
                  value={dateFromISO(model.selectedDate)}
                  mode="date"
                  display={model.isIos ? "inline" : "default"}
                  onChange={(event, date) => actions.changeNativeDate(event.type, date)}
                />
                {model.isIos ? (
                  <Pressable onPress={actions.closeDatePicker} style={{ height: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>Cerrar calendario</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          ) : null}
        </View>
      </Animated.View>
      <Animated.View style={{
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        backgroundColor: mobileTheme.color.bgSurface,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: scrollY.interpolate({ inputRange: [0, 120], outputRange: [14, 8], extrapolate: "clamp" }),
        gap: scrollY.interpolate({ inputRange: [0, 120], outputRange: [10, 6], extrapolate: "clamp" }),
        marginTop: scrollY.interpolate({ inputRange: [0, 70], outputRange: [8, 0], extrapolate: "clamp" }),
      }}>
        <Animated.View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          opacity: scrollY.interpolate({ inputRange: [40, 100], outputRange: [1, 0], extrapolate: "clamp" }),
          maxHeight: scrollY.interpolate({ inputRange: [40, 120], outputRange: [60, 0], extrapolate: "clamp" }),
          overflow: "hidden",
        }}>
          <View>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "800" }}>
              {formatNutritionNumber(model.caloriesConsumed)}/{formatNutritionNumber(model.caloriesTarget)}
            </Text>
            <Text style={{ color: mobileTheme.color.textSecondary, marginTop: -2 }}>kcal consumidas</Text>
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: "rgba(203,255,26,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "800", fontSize: 14 }}>{model.caloriesPercent}%</Text>
          </View>
        </Animated.View>
        <View style={{ height: 8, borderRadius: mobileTheme.radius.pill, backgroundColor: "rgba(255,255,255,0.09)", overflow: "hidden", flexDirection: "row" }}>
          {model.caloriesProgress > 1 ? (
            <>
              <View style={{ height: "100%", width: `${(1 / model.caloriesProgress) * 100}%`, backgroundColor: mobileTheme.color.brandPrimary }} />
              <View style={{ height: "100%", flex: 1, backgroundColor: "#FF4444" }} />
            </>
          ) : (
            <View style={{ height: "100%", width: `${Math.max(0, model.caloriesProgress * 100)}%`, backgroundColor: mobileTheme.color.brandPrimary, borderRadius: mobileTheme.radius.pill }} />
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {model.macroOverview.map((macro) => {
            const progress = macro.total > 0 ? Math.max(0, macro.consumed / macro.total) : 0;
            return (
              <View key={macro.key} style={{ flex: 1, gap: 3 }}>
                <Animated.View style={{
                  opacity: scrollY.interpolate({ inputRange: [40, 100], outputRange: [1, 0], extrapolate: "clamp" }),
                  maxHeight: scrollY.interpolate({ inputRange: [40, 120], outputRange: [50, 0], extrapolate: "clamp" }),
                  overflow: "hidden",
                  gap: 1,
                }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "800" }}>
                    {formatNutritionNumber(macro.consumed)}/{formatNutritionNumber(macro.total)}g
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{macro.label}</Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{macro.total > 0 ? Math.round((macro.consumed / macro.total) * 100) : 0}%</Text>
                  </View>
                </Animated.View>
                <View style={{ height: 5, borderRadius: mobileTheme.radius.pill, backgroundColor: "rgba(255,255,255,0.09)", overflow: "hidden", flexDirection: "row" }}>
                  {progress > 1 ? (
                    <>
                      <View style={{ height: "100%", width: `${(1 / progress) * 100}%`, backgroundColor: macro.accent }} />
                      <View style={{ height: "100%", flex: 1, backgroundColor: "#FF4444" }} />
                    </>
                  ) : (
                    <View style={{ height: "100%", width: `${Math.max(0, progress * 100)}%`, backgroundColor: macro.accent, borderRadius: mobileTheme.radius.pill }} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
        {model.exceededBudgetCalories !== null ? (
          <Animated.View
            testID="diet-saved-plan-budget-warning"
            accessibilityLiveRegion="polite"
            style={{
              opacity: scrollY.interpolate({ inputRange: [40, 100], outputRange: [1, 0], extrapolate: "clamp" }),
              maxHeight: scrollY.interpolate({ inputRange: [40, 120], outputRange: [48, 0], extrapolate: "clamp" }),
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,90,95,0.55)",
              backgroundColor: "rgba(255,90,95,0.08)",
              borderRadius: mobileTheme.radius.md,
              paddingHorizontal: 10,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: "#FF8D8D", fontSize: 11, lineHeight: 16 }}>
              El plan de macros supera el objetivo diario en {model.exceededBudgetCalories.toFixed(0)} kcal.
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
});

const DIET_MEAL_META: Record<
  DietMealCategory,
  { icon: keyof typeof Feather.glyphMap; accent: string; dot: string }
> = {
  Desayuno: { icon: "sunrise", accent: "#F7A547", dot: "#F7A547" },
  Almuerzo: { icon: "sun", accent: "#FFD84D", dot: "#FFD84D" },
  Comida: { icon: "sun", accent: "#CBFF1A", dot: "#CBFF1A" },
  Merienda: { icon: "coffee", accent: "#4D84FF", dot: "#4D84FF" },
  Cena: { icon: "moon", accent: "#7D6DFF", dot: "#7D6DFF" },
};

function DietItemThumbnail({ uri, dotColor }: { uri?: string | null; dotColor: string }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />;
  }
  return <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dotColor, marginTop: 8 }} />;
}

function FoodThumbnail({ food }: { food: FoodCatalogEntry }) {
  const [failed, setFailed] = useState(false);
  const uri = foodCatalogImageUri(food);
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />;
  }
  return (
    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(203,255,26,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Feather name="coffee" size={15} color={mobileTheme.color.brandPrimary} />
    </View>
  );
}

export const DietMealsScreen = memo(function DietMealsScreen({
  model,
  actions,
}: {
  model: Readonly<DietScreenModel>;
  actions: Readonly<DietScreenActions>;
}) {
  return (
    <View style={{ gap: 12, paddingBottom: 86 }}>
      {model.meals.map((meal) => {
        const category = meal.title as DietMealCategory;
        const meta = DIET_MEAL_META[category];
        const expanded = model.expandedMeals[category];
        const editing = model.editorCategory === category;
        const editingExisting = editing && model.editingItem?.meal_id === meal.id;
        const calories = meal.items.reduce((total, item) => total + item.calories_kcal, 0);
        const protein = meal.items.reduce((total, item) => total + item.protein_g, 0);
        const carbs = meal.items.reduce((total, item) => total + item.carbs_g, 0);
        const fat = meal.items.reduce((total, item) => total + item.fat_g, 0);
        return (
          <View
            key={meal.id}
            testID={editing ? shellSurfaceTestId("diet-meal-editor") : undefined}
            style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: 18, overflow: "hidden" }}
          >
            <Pressable testID={`diet-meal-category-${category.toLowerCase()}`} onPress={() => actions.toggleMeal(category)} style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: `${meta.accent}22` }}>
                    <Feather name={meta.icon} size={15} color={meta.accent} />
                  </View>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>{category}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                    P:{formatNutritionNumber(protein)} C:{formatNutritionNumber(carbs)} G:{formatNutritionNumber(fat)}
                  </Text>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={mobileTheme.color.textSecondary} />
                </View>
              </View>
              <Text style={{ color: mobileTheme.color.textSecondary }}>
                {formatNutritionNumber(calories)} kcal · {meal.items.length} {meal.items.length === 1 ? "item" : "items"}
              </Text>
            </Pressable>
            {expanded ? (
              <View style={{ borderTopWidth: 1, borderTopColor: mobileTheme.color.borderSubtle, paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
                {meal.items.length === 0 ? (
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>Sin alimentos registrados.</Text>
                ) : meal.items.map((item) => {
                  const menuOpen = model.itemMenu?.meal_id === meal.id && model.itemMenu.item_id === item.id;
                  return (
                    <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                        <DietItemThumbnail uri={item.image_uri} dotColor={meta.dot} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>{item.title}</Text>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, marginTop: 1 }}>
                            {item.grams > 0 ? `${formatNutritionNumber(item.grams)} g · ` : ""}P:{formatNutritionNumber(item.protein_g)} C:{formatNutritionNumber(item.carbs_g)} G:{formatNutritionNumber(item.fat_g)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600" }}>{formatNutritionNumber(item.calories_kcal)} kcal</Text>
                          <Pressable onPress={() => actions.toggleItemMenu(meal.id, item.id)} style={{ width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                            <Feather name="more-vertical" size={14} color={mobileTheme.color.textSecondary} />
                          </Pressable>
                        </View>
                        {menuOpen ? (
                          <View testID={shellSurfaceTestId("diet-item-menu")} style={{ minWidth: 124, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 12, backgroundColor: "rgba(12,14,19,0.96)", paddingVertical: 4 }}>
                            {[
                              { label: "Editar a mano", icon: "edit-3" as const, color: mobileTheme.color.textPrimary, press: () => actions.editItem(category, meal, item) },
                              { label: "Editar con IA", icon: "cpu" as const, color: mobileTheme.color.textPrimary, press: () => actions.editItemWithAi(category, meal, item) },
                              { label: "Eliminar", icon: "trash-2" as const, color: "#FF7B7B", press: () => actions.deleteItem(meal, item) },
                            ].map((option) => (
                              <Pressable key={option.label} onPress={option.press} style={{ minHeight: 36, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Feather name={option.icon} size={13} color={option.color} />
                                <Text style={{ color: option.color, fontWeight: "600" }}>{option.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                <View style={{ gap: 8 }}>
                  <CatalogStatusNotice metadata={model.catalogAvailability} onRetry={actions.retryCatalog} testID={`diet-food-catalog-status-${category.toLowerCase()}`} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, paddingHorizontal: 10 }}>
                    <Feather name="search" size={14} color={mobileTheme.color.textSecondary} />
                    <TextInput
                      value={model.editorCategory === category ? model.foodSearch : ""}
                      onChangeText={(value) => actions.changeFoodSearch(category, value)}
                      onFocus={actions.focusFoodSearch}
                      placeholder="Buscar alimento..."
                      placeholderTextColor={mobileTheme.color.textSecondary}
                      style={{ flex: 1, minHeight: 42, color: mobileTheme.color.textPrimary, fontSize: 14 }}
                    />
                    {model.editorCategory === category && model.foodSearch ? (
                      <Pressable onPress={actions.clearFoodSearch}><Feather name="x" size={16} color={mobileTheme.color.textSecondary} /></Pressable>
                    ) : null}
                  </View>
                  {model.editorCategory === category && model.foodSearch.trim() ? (
                    <ScrollView style={{ maxHeight: 240 }}>
                      {model.foodSearchResults.map((food) => (
                        <Pressable key={`${food.sourceId}/${food.id}`} onPress={() => actions.selectFood(category, food)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle }}>
                          <FoodThumbnail food={food} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "600" }}>{food.name}</Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, marginTop: 2 }}>{food.calories_per_100g} kcal/100g · {food.serving_description || `${food.serving_size_g}g`}</Text>
                          </View>
                        </Pressable>
                      ))}
                      {model.foodSearchResults.length === 0 ? (
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, padding: 10, fontStyle: "italic" }}>No se encontraron alimentos.</Text>
                      ) : null}
                    </ScrollView>
                  ) : null}
                </View>
                {editing && model.addMode === "selected" && model.selectedFood && model.selectedFoodPreview ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 16 }}>{model.selectedFood.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>Cantidad (g):</Text>
                      <TextInput
                        testID="selected-food-grams-input"
                        value={model.selectedGrams}
                        onChangeText={actions.changeSelectedGrams}
                        keyboardType="decimal-pad"
                        autoFocus
                        style={{ flex: 1, minHeight: 42, borderWidth: 1, borderColor: model.nutritionIssues.has("grams") ? "#FF5A5F" : mobileTheme.color.brandPrimary, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, fontSize: 16, fontWeight: "700" }}
                      />
                    </View>
                    {model.nutritionIssues.get("grams") ? <Text style={{ color: "#FF7B7B", fontSize: 12 }}>{model.nutritionIssues.get("grams")?.message}</Text> : null}
                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                      {[
                        { label: "Calorías", value: `${model.selectedFoodPreview.calories} kcal`, color: "#F7A547" },
                        { label: "Proteína", value: `${model.selectedFoodPreview.protein} g`, color: "#4ECDC4" },
                        { label: "Carbos", value: `${model.selectedFoodPreview.carbs} g`, color: "#77A8FF" },
                        { label: "Grasa", value: `${model.selectedFoodPreview.fat} g`, color: "#FF6B6B" },
                      ].map((macro) => (
                        <View key={macro.label} style={{ alignItems: "center", minWidth: 65 }}>
                          <Text style={{ color: macro.color, fontSize: 16, fontWeight: "700" }}>{macro.value}</Text>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{macro.label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={actions.saveSelectedFood} style={{ flex: 1, minHeight: 42, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#000", fontWeight: "700" }}>Guardar</Text>
                      </Pressable>
                      <Pressable onPress={actions.returnToFoodSearch} style={{ flex: 1, minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Volver</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {editing && (model.addMode === "form" || model.addMode === null) ? (
                  <View style={{ gap: 8 }}>
                    {[
                      { field: "name" as const, label: "Nombre del alimento", test: "manual-food-name-input", keyboard: undefined, width: undefined },
                      { field: "grams" as const, label: "Gramos (g)", test: "manual-food-grams-input", keyboard: "decimal-pad" as const, width: 110 },
                      { field: "calories_kcal" as const, label: "Calorías (kcal)", test: "manual-food-calories-input", keyboard: "decimal-pad" as const, width: 110 },
                      { field: "protein_g" as const, label: "Proteínas (g)", test: "manual-food-protein_g-input", keyboard: "decimal-pad" as const, width: 110 },
                      { field: "carbs_g" as const, label: "Carbohidratos (g)", test: "manual-food-carbs_g-input", keyboard: "decimal-pad" as const, width: 110 },
                      { field: "fat_g" as const, label: "Grasas (g)", test: "manual-food-fat_g-input", keyboard: "decimal-pad" as const, width: 110 },
                    ].map((field) => (
                      <View key={field.field} style={{ gap: 4 }}>
                        <View style={{ flexDirection: field.width ? "row" : "column", alignItems: field.width ? "center" : undefined, gap: 8 }}>
                          {field.width ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, width: field.width }}>{field.label}</Text> : null}
                          <TextInput
                            testID={field.test}
                            value={model.manualFields[field.field]}
                            onChangeText={(value) => actions.changeManualField(field.field, value)}
                            placeholder={field.label}
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            keyboardType={field.keyboard}
                            style={{ flex: field.width ? 1 : undefined, minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: model.nutritionIssues.has(field.field) ? "#FF5A5F" : mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 }}
                          />
                        </View>
                        {model.nutritionIssues.get(field.field) ? (
                          <Text testID={`manual-food-${field.field}-error`} style={{ color: "#FF7B7B", fontSize: 12, marginLeft: field.width ? 118 : 0 }}>{model.nutritionIssues.get(field.field)?.message}</Text>
                        ) : null}
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable testID="save-manual-food" onPress={actions.saveManualFood} style={{ flex: 1, minHeight: 42, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#06090D", fontWeight: "700" }}>{editingExisting ? "Guardar cambios" : "Guardar alimento"}</Text>
                      </Pressable>
                      <Pressable onPress={actions.cancelMealEditor} style={{ flex: 1, minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {!editing ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable testID={`open-manual-food-${category.toLowerCase()}`} onPress={() => actions.openManualFood(category)} style={{ flex: 1, minHeight: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, backgroundColor: mobileTheme.color.bgApp }}>
                      <Feather name="edit-3" size={13} color={mobileTheme.color.textSecondary} />
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Añadir a mano</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Añadir alimento con Gymnasia Food Estimator a ${category}`} testID={`open-food-estimator-${category.toLowerCase()}`} onPress={() => actions.openFoodEstimator(category)} style={{ flex: 1, minHeight: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, backgroundColor: mobileTheme.color.bgApp }}>
                      <Feather name="cpu" size={13} color={mobileTheme.color.textSecondary} />
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Añadir con IA</Text>
                    </Pressable>
                  </View>
                ) : null}
                {!editing ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => actions.repeatPreviousDay(category)} style={{ flex: 1, minHeight: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, backgroundColor: mobileTheme.color.bgApp }}>
                      <Feather name="rotate-ccw" size={13} color={mobileTheme.color.textSecondary} />
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Repetir día anterior</Text>
                    </Pressable>
                    <Pressable onPress={() => actions.repeatFromDate(category)} style={{ flex: 1, minHeight: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, backgroundColor: mobileTheme.color.bgApp }}>
                      <Feather name="calendar" size={13} color={mobileTheme.color.textSecondary} />
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Repetir del día...</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});
