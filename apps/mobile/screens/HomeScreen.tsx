import { memo, type ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import type { HomeScreenActions, HomeScreenModel } from "../controllers/homeController";
import { mobileTheme } from "../theme";

function PrimaryButton({
  label,
  onPress,
  icon,
  testID,
}: {
  label: string;
  onPress(): void;
  icon?: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        height: 46,
        borderRadius: 12,
        backgroundColor: mobileTheme.color.brandPrimary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? 10 : 0,
      }}
    >
      {icon}
      <Text style={{ color: "#06090D", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  subtitleColor,
  icon,
  testID,
}: {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor?: string;
  icon: ReactNode;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        minHeight: 94,
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        backgroundColor: mobileTheme.color.bgSurface,
        borderRadius: 18,
        padding: 12,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </View>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" }}>
        {value}
      </Text>
      <Text
        style={{
          color: subtitleColor ?? "#7F8896",
          fontSize: 11,
          fontWeight: subtitleColor ? "700" : "400",
          marginTop: "auto",
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

export const HomeScreen = memo(function HomeScreen({
  model,
  actions,
}: {
  model: Readonly<HomeScreenModel>;
  actions: Readonly<HomeScreenActions>;
}) {
  return (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: mobileTheme.color.borderSubtle,
          backgroundColor: "#10151D",
          borderRadius: 28,
          padding: 14,
          gap: 14,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 196,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            backgroundColor: "#091219",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {model.featuredHeroImageUri ? (
            <Image
              source={{ uri: model.featuredHeroImageUri }}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.18 }}
              resizeMode="cover"
            />
          ) : null}
          <View
            style={{
              position: "absolute",
              top: -46,
              right: -18,
              width: 170,
              height: 170,
              borderRadius: 999,
              backgroundColor: "rgba(54,132,121,0.22)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -34,
              left: -12,
              width: 140,
              height: 140,
              borderRadius: 999,
              backgroundColor: "rgba(8,84,101,0.22)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 22,
              right: 22,
              width: 88,
              height: 88,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(203,255,26,0.22)",
              backgroundColor: "rgba(8,14,20,0.78)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name={model.featuredIcon ?? "activity"}
              size={32}
              color={mobileTheme.color.brandPrimary}
            />
          </View>
          <View
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 122,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {model.featuredCategoryMeta ? (
              <View
                style={{
                  minHeight: 30,
                  borderRadius: mobileTheme.radius.pill,
                  backgroundColor: "rgba(6,9,13,0.5)",
                  paddingHorizontal: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: model.featuredCategoryMeta.color,
                  }}
                />
                <Text style={{ color: "#E8EDF5", fontSize: 12, fontWeight: "700" }}>
                  {model.featuredCategoryMeta.label}
                </Text>
              </View>
            ) : null}
            {model.featuredDurationMinutes > 0 ? (
              <View
                style={{
                  minHeight: 30,
                  borderRadius: mobileTheme.radius.pill,
                  backgroundColor: "rgba(6,9,13,0.5)",
                  paddingHorizontal: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#BFC8D6", fontSize: 12, fontWeight: "600" }}>
                  {model.featuredDurationMinutes} min
                </Text>
              </View>
            ) : null}
          </View>
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              left: 0,
              paddingHorizontal: 16,
              paddingVertical: 16,
              backgroundColor: "rgba(6,9,13,0.58)",
              gap: 6,
            }}
          >
            <Text
              style={{ color: "#F4F7FB", fontSize: 24, fontWeight: "700" }}
              numberOfLines={2}
            >
              {model.featuredTemplateName ?? "Prepara tu próximo entrenamiento"}
            </Text>
            <Text style={{ color: "#B9C3D1", fontSize: 13, lineHeight: 18 }}>
              {model.featuredTemplateName
                ? `${model.featuredExercises.length} ejercicios listos para hoy${model.featuredDurationMinutes > 0 ? ` • ${model.featuredDurationMinutes} min aprox.` : ""}`
                : "Crea tu primera rutina para tener un inicio rápido desde la Home."}
            </Text>
          </View>
        </View>

        <PrimaryButton
          label={model.primaryActionLabel}
          onPress={actions.runPrimaryTrainingAction}
          icon={<Feather name="play" size={16} color="#06090D" />}
          testID="home-primary-training-action"
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard
          label="Calorías"
          value={Math.round(model.caloriesConsumed).toLocaleString("es-ES")}
          subtitle={model.caloriesTarget > 0
            ? `${Math.round(model.caloriesConsumed)}/${Math.round(model.caloriesTarget)} kcal`
            : "Consumidas hoy"}
          icon={<Feather name="zap" size={14} color={mobileTheme.color.brandPrimary} />}
        />
        <StatCard
          label="Peso"
          value={model.latestWeightKg !== null ? `${Math.round(model.latestWeightKg * 10) / 10}` : "--"}
          subtitle={model.latestWeightKg !== null ? model.weightChangeText : "Sin registro"}
          subtitleColor="#19C37D"
          icon={<Feather name="activity" size={14} color={mobileTheme.color.brandPrimary} />}
        />
        <StatCard
          label="Racha"
          value={String(model.workoutStreak)}
          subtitle={model.workoutStreak === 1 ? "día seguido" : "días seguidos"}
          icon={<Feather name="award" size={14} color={mobileTheme.color.brandPrimary} />}
          testID="home-workout-streak"
        />
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: mobileTheme.color.borderSubtle,
          backgroundColor: mobileTheme.color.bgSurface,
          borderRadius: 24,
          padding: 14,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
            Progreso semanal
          </Text>
          <Text testID="home-week-completed-count" style={{ color: "#7F8896", fontSize: 13, fontWeight: "700" }}>
            {model.weekCompletedCount}/7
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {model.weekProgress.map((day) => (
            <View key={day.key} style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <Text
                style={{
                  color: day.isToday ? mobileTheme.color.brandPrimary : "#8B94A3",
                  fontSize: 12,
                  fontWeight: day.isToday ? "800" : "700",
                }}
              >
                {day.label}
              </Text>
              <View
                style={{
                  width: "100%",
                  minHeight: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: day.isToday
                    ? "rgba(203,255,26,0.42)"
                    : day.completed
                      ? "rgba(203,255,26,0.2)"
                      : "rgba(255,255,255,0.06)",
                  backgroundColor: day.isToday
                    ? "rgba(203,255,26,0.12)"
                    : day.completed
                      ? "rgba(203,255,26,0.06)"
                      : "#11161D",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: day.completed ? 10 : 7,
                    height: day.completed ? 10 : 7,
                    borderRadius: 999,
                    backgroundColor: day.completed
                      ? mobileTheme.color.brandPrimary
                      : "rgba(255,255,255,0.18)",
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
              Ejercicios de hoy
            </Text>
            <Text style={{ color: "#7F8896", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {model.featuredTemplateName ?? "Sin rutina seleccionada"}
            </Text>
          </View>
          <Pressable onPress={actions.openTraining}>
            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
              Ver todo
            </Text>
          </Pressable>
        </View>

        {model.featuredExercises.length === 0 ? (
          <View
            style={{
              minHeight: 128,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgSurface,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ color: "#8B94A3", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
              Añade una rutina en Entrenamiento para ver tu selección del día aquí.
            </Text>
          </View>
        ) : (
          model.featuredExercises.map((exercise) => (
            <View
              key={exercise.id}
              style={{
                borderWidth: 1,
                borderColor: mobileTheme.color.borderSubtle,
                backgroundColor: mobileTheme.color.bgSurface,
                borderRadius: 18,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: exercise.previewMeta.backgroundColor,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {exercise.imageUri ? (
                  <Image source={{ uri: exercise.imageUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Feather name={exercise.previewMeta.icon} size={16} color={exercise.previewMeta.accentColor} />
                    <Text style={{ color: "#E8EDF5", fontSize: 9, fontWeight: "700" }}>
                      {exercise.previewMeta.label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}
                  numberOfLines={1}
                >
                  {exercise.exerciseName}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 12 }} numberOfLines={1}>
                  {exercise.volumeLabel}
                </Text>
              </View>
              <Pressable
                onPress={actions.runPrimaryTrainingAction}
                testID={`home-exercise-start-${exercise.id}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: mobileTheme.color.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="play" size={15} color="#06090D" />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
});
