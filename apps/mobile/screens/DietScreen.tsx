import { memo } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Animated, Pressable, Text, TextInput, View } from "react-native";

import type { DietScreenActions, DietScreenModel } from "../controllers/dietController";
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
