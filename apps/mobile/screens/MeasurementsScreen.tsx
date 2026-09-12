import { memo, useState, type ReactNode } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type {
  MeasurementsScreenActions,
  MeasurementsScreenModel,
} from "../controllers/measurementsController";
import { DIET_MONTH_LABELS_SHORT } from "../diet/model";
import { localDateKey } from "../measurements/measurementContract";
import { BODY_FAT_ZONES_FEMALE, BODY_FAT_ZONES_MALE, formatMeasurementDate, formatMeasurementHistoryDate, formatMeasurementNumber } from "../measurements/presentationModel";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

function StatCard({
  label,
  value,
  subtitle,
  subtitleColor,
  subtitleIcon,
  testID,
}: {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor: string;
  subtitleIcon: ReactNode;
  testID: string;
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
      <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" }}>
        {value}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: "auto" }}>
        {subtitleIcon}
        <Text style={{ color: subtitleColor, fontSize: 11, fontWeight: "700", flex: 1 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function ChartCard({
  title,
  periodSelector,
  zIndex,
  children,
}: {
  title: ReactNode;
  periodSelector: ReactNode;
  zIndex: number;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: mobileTheme.color.bgSurface,
        position: "relative",
        overflow: "visible",
        zIndex,
        padding: 14,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, zIndex: 2 }}>
        <View style={{ flex: 1, gap: 4 }}>{title}</View>
        {periodSelector}
      </View>
      {children}
    </View>
  );
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 1) return `M${points[0].x},${points[0].y}L${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
}

function MeasurementsChartPlot({
  model,
  actions,
}: {
  model: Readonly<MeasurementsScreenModel>;
  actions: Readonly<MeasurementsScreenActions>;
}) {
  const [width, setWidth] = useState(0);
  if (model.chartPoints.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
        <Text style={{ color: "#8B94A3", fontSize: 13, lineHeight: 18, textAlign: "center" }}>
          {model.hasMetricMeasurements
            ? `No hay registros de ${model.metricMeta.label.toLowerCase()} suficientes para este periodo.`
            : `Registra ${model.metricMeta.label.toLowerCase()} para ver la evolución.`}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
      }}
    >
      {width > 0 ? (() => {
        const chartHeight = 160;
        const padLeft = 36;
        const padRight = 12;
        const padTop = 8;
        const padBottom = 24;
        const plotWidth = width - padLeft - padRight;
        const plotHeight = chartHeight - padTop - padBottom;
        const points = model.chartPoints;
        const values = points.map((point) => point.value);
        const rawMinimum = Math.min(...values);
        const rawMaximum = Math.max(...values);
        const bodyFatPadding = model.metric === "bodyFat" ? 3 : 1;
        const minimum = Math.floor(rawMinimum) - bodyFatPadding;
        const maximum = Math.ceil(rawMaximum) + bodyFatPadding;
        const valueRange = Math.max(0.4, maximum - minimum);
        const minimumTime = points[0].timestamp;
        const maximumTime = points[points.length - 1].timestamp;
        const timeRange = Math.max(1, maximumTime - minimumTime);
        const coordinates = points.map((point) => ({
          x: padLeft + (points.length === 1 ? plotWidth / 2 : ((point.timestamp - minimumTime) / timeRange) * plotWidth),
          y: padTop + plotHeight - ((point.value - minimum) / valueRange) * plotHeight,
        }));
        const linePath = buildSmoothPath(coordinates);
        const areaPath = `${linePath}L${coordinates[coordinates.length - 1].x},${padTop + plotHeight}L${coordinates[0].x},${padTop + plotHeight}Z`;
        const movingAverage = (windowSize: number) => coordinates.map((coordinate, index) => {
          const fullIndex = model.allMetricValues.findIndex((point) => point.timestamp === points[index].timestamp);
          const source = fullIndex === -1 ? values : model.allMetricValues.map((point) => point.value);
          const endIndex = fullIndex === -1 ? index : fullIndex;
          const windowValues = source.slice(Math.max(0, endIndex - windowSize + 1), endIndex + 1);
          const average = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
          return {
            x: coordinate.x,
            y: padTop + plotHeight - ((average - minimum) / valueRange) * plotHeight,
          };
        });
        const movingAverage10Path = buildSmoothPath(movingAverage(10));
        const movingAverage30Path = buildSmoothPath(movingAverage(30));
        const middle = minimum + valueRange / 2;
        const gridLines = [
          { y: padTop, label: formatMeasurementNumber(maximum) },
          { y: padTop + plotHeight / 2, label: formatMeasurementNumber(middle) },
          { y: padTop + plotHeight, label: formatMeasurementNumber(minimum) },
        ];
        const zones = model.sex === "female" ? BODY_FAT_ZONES_FEMALE : BODY_FAT_ZONES_MALE;
        const zoneLabels = ["Subatl.", "Atlético", "Saludable", "Aceptable", "Obesidad", "S. obes."];
        const startDate = new Date(minimumTime);
        const endDate = new Date(maximumTime);
        const multipleYears = startDate.getFullYear() !== endDate.getFullYear();
        const axisLabels = Array.from({ length: 4 }, (_, index) => {
          const date = new Date(minimumTime + (timeRange * index) / 3);
          const month = DIET_MONTH_LABELS_SHORT[date.getMonth()];
          const year = multipleYears ? ` '${String(date.getFullYear()).slice(2)}` : "";
          return model.period === "all" || model.period === "6m"
            ? `${month}${year}`
            : `${date.getDate()} ${month}${year}`;
        });
        return (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 6, paddingLeft: padLeft }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 16, height: 0, borderTopWidth: 2, borderTopColor: "#7EC8FF", borderStyle: "dashed" }} />
                <Text style={{ color: "#7EC8FF", fontSize: 8, fontWeight: "600" }}>Media 10 valores</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 16, height: 0, borderTopWidth: 2, borderTopColor: "#2B5C8A", borderStyle: "dotted" }} />
                <Text style={{ color: "#2B5C8A", fontSize: 8, fontWeight: "600" }}>Media 30 valores</Text>
              </View>
            </View>
            {model.metric === "bodyFat" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6, paddingLeft: padLeft }}>
                {[
                  ["Subatlético", "rgba(255,75,75,0.45)"],
                  ["Atlético", "rgba(203,255,26,0.45)"],
                  ["Saludable", "rgba(0,198,107,0.45)"],
                  ["Aceptable", "rgba(203,255,26,0.45)"],
                  ["Obesidad", "rgba(255,140,0,0.45)"],
                  ["Sobre obesidad", "rgba(255,75,75,0.45)"],
                ].map(([label, color]) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                    <Text style={{ color: "#8B94A3", fontSize: 7, fontWeight: "600" }}>{label}</Text>
                  </View>
                ))}
                <Pressable onPress={actions.openBodyFatInfo} hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={14} color="#8B94A3" />
                </Pressable>
              </View>
            ) : null}
            <Svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${chartHeight}`}>
              <Defs>
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={mobileTheme.color.brandPrimary} stopOpacity="0.35" />
                  <Stop offset="1" stopColor={mobileTheme.color.brandPrimary} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              {gridLines.map((line, index) => (
                <Path key={`grid-${index}`} d={`M${padLeft},${line.y}L${width - padRight},${line.y}`} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              ))}
              {model.metric === "bodyFat" ? zones.map((zone, index) => {
                const y1 = padTop + plotHeight - ((Math.min(zone.max, maximum) - minimum) / valueRange) * plotHeight;
                const y2 = padTop + plotHeight - ((Math.max(zone.min, minimum) - minimum) / valueRange) * plotHeight;
                const top = Math.max(padTop, Math.min(padTop + plotHeight, y1));
                const bottom = Math.max(padTop, Math.min(padTop + plotHeight, y2));
                return bottom > top ? <Rect key={`zone-${index}`} x={padLeft} y={top} width={plotWidth} height={bottom - top} fill={zone.color} /> : null;
              }) : null}
              {model.metric === "bodyFat" ? zones.slice(0, -1).flatMap((zone, index) => {
                const y = padTop + plotHeight - ((zone.max - minimum) / valueRange) * plotHeight;
                if (y < padTop || y > padTop + plotHeight) return [];
                const elements: React.JSX.Element[] = [
                  <Path key={`zone-line-${index}`} d={`M${padLeft},${y}L${padLeft + plotWidth},${y}`} stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} strokeDasharray="3,3" />,
                ];
                if (y - 6 >= padTop) elements.push(<SvgText key={`zone-above-${index}`} x={padLeft + 3} y={y - 3} fill="rgba(255,255,255,0.35)" fontSize={6} fontWeight="600">{zoneLabels[index + 1]}</SvgText>);
                if (y + 8 <= padTop + plotHeight) elements.push(<SvgText key={`zone-below-${index}`} x={padLeft + 3} y={y + 8} fill="rgba(255,255,255,0.35)" fontSize={6} fontWeight="600">{zoneLabels[index]}</SvgText>);
                return elements;
              }) : <Path d={areaPath} fill="url(#areaGrad)" />}
              <Path d={linePath} fill="none" stroke={mobileTheme.color.brandPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.5} />
              {points.length >= 3 ? <Path d={movingAverage10Path} fill="none" stroke="#7EC8FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.6} strokeDasharray="6,4" /> : null}
              {points.length >= 3 ? <Path d={movingAverage30Path} fill="none" stroke="#2B5C8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} strokeDasharray="2,4" /> : null}
              {coordinates.map((coordinate, index) => <Circle key={points[index].key} cx={coordinate.x} cy={coordinate.y} r={1} fill={mobileTheme.color.brandPrimary} />)}
            </Svg>
            <View style={{ height: 16, position: "relative", marginLeft: padLeft, marginRight: padRight }}>
              {axisLabels.map((label, index) => (
                <Text
                  key={`label-${index}`}
                  style={{ position: "absolute", left: `${(index / 3) * 100}%`, transform: [{ translateX: -28 }], width: 56, textAlign: "center", color: "#7F8795", fontSize: 9, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              ))}
            </View>
            <View style={{ position: "absolute", top: 0, left: 0 }}>
              {gridLines.map((line, index) => (
                <Text key={`scale-${index}`} style={{ position: "absolute", top: line.y - 6, left: 0, color: "#4E5665", fontSize: 10 }}>
                  {line.label}
                </Text>
              ))}
            </View>
          </View>
        );
      })() : null}
    </View>
  );
}

export const MeasurementsScreen = memo(function MeasurementsScreen({
  model,
  actions,
}: {
  model: Readonly<MeasurementsScreenModel>;
  actions: Readonly<MeasurementsScreenActions>;
}) {
  return (
    <View style={{ gap: 14 }}>
      {model.duplicateDateCount > 0 ? (
        <View
          testID="measurement-duplicate-warning"
          accessibilityLiveRegion="polite"
          style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,190,92,0.45)", backgroundColor: "rgba(255,190,92,0.10)", padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}
        >
          <Feather name="alert-triangle" size={17} color="#FFBE5C" style={{ marginTop: 1 }} />
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, lineHeight: 18, flex: 1 }}>
            {`Hay mediciones repetidas en ${model.duplicateDateCount} fecha(s). Se conservan sin fusionar; edítalas o elimínalas desde el historial.`}
          </Text>
        </View>
      ) : null}
      {model.mediaNotice ? (
        <View accessibilityLiveRegion="polite" style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,190,92,0.45)", backgroundColor: "rgba(255,190,92,0.10)", padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Feather name="alert-circle" size={17} color="#FFBE5C" style={{ marginTop: 1 }} />
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, lineHeight: 18, flex: 1 }}>{model.mediaNotice}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable testID="measurement-add" onPress={actions.openEntry} style={{ minHeight: 44, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Ionicons name="add-circle-outline" size={18} color="#06090D" />
          <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 14 }}>Registrar</Text>
        </Pressable>
      </View>
      {model.statCardRows.map((row, rowIndex) => (
        <View key={`measures-row-${rowIndex}`} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((card) => (
            <StatCard
              key={card.label}
              testID={`measurement-stat-${card.label}`}
              label={card.label}
              value={card.valueText}
              subtitle={card.changeText}
              subtitleColor={card.changeColor}
              subtitleIcon={<Feather name={card.changeIcon} size={11} color={card.changeColor} style={{ marginTop: 2 }} />}
            />
          ))}
        </View>
      ))}
      <ChartCard
        zIndex={model.metricDropdownOpen || model.periodDropdownOpen ? 10 : 1}
        title={(
          <Pressable testID="measures-chart-metric-current" accessibilityRole="button" accessibilityLabel="Métrica de la gráfica" accessibilityValue={{ text: model.metricMeta.label }} onPress={actions.toggleMetricDropdown} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>{model.metricMeta.label}</Text>
            <Ionicons name={model.metricDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={mobileTheme.color.textSecondary} />
          </Pressable>
        )}
        periodSelector={(
          <Pressable testID="measures-chart-period-current" accessibilityRole="button" accessibilityLabel="Periodo de la gráfica" accessibilityValue={{ text: model.periodMeta.label }} onPress={actions.togglePeriodDropdown} style={{ minHeight: 34, borderRadius: mobileTheme.radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1B2029", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Text style={{ color: "#9EA6B3", fontSize: 12, fontWeight: "700" }}>{model.periodMeta.label}</Text>
            <Ionicons name={model.periodDropdownOpen ? "chevron-up" : "chevron-down"} size={14} color="#6F7785" />
          </Pressable>
        )}
      >
        {model.periodDropdownOpen ? (
          <View testID={shellSurfaceTestId("measures-period-dropdown")} style={{ position: "absolute", top: 56, right: 14, zIndex: 20, elevation: 12 }}>
            <View style={{ minWidth: 128, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1B2029", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, padding: 6, gap: 4 }}>
              {model.periodOptions.map((option) => {
                const active = model.period === option.key;
                return (
                  <Pressable key={option.key} testID={`measures-chart-period-option-${option.key}`} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => actions.selectPeriod(option.key)} style={{ minHeight: 34, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: active ? "rgba(203,255,26,0.12)" : "transparent" }}>
                    <Text style={{ color: active ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {model.metricDropdownOpen ? (
          <View testID={shellSurfaceTestId("measures-metric-dropdown")} style={{ position: "absolute", top: 56, left: 14, zIndex: 20, elevation: 12 }}>
            <View style={{ minWidth: 150, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1B2029", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, padding: 6, gap: 4 }}>
              {model.metricOptions.map((option) => {
                const active = model.metric === option.key;
                return (
                  <Pressable key={option.key} testID={`measures-chart-metric-option-${option.key}`} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => actions.selectMetric(option.key)} style={{ minHeight: 34, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: active ? "rgba(203,255,26,0.12)" : "transparent" }}>
                    <Text style={{ color: active ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={{ minHeight: 214, borderRadius: 18, backgroundColor: "#11161E", zIndex: 1, paddingVertical: 12, paddingHorizontal: 10, flexDirection: "row", gap: 10 }}>
          <MeasurementsChartPlot model={model} actions={actions} />
        </View>
      </ChartCard>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>Historial de registros</Text>
          {model.canExpandHistory ? (
            <Pressable testID={shellSurfaceTestId("measurements-history-expanded")} onPress={actions.toggleHistory}>
              <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "800" }}>{model.showAllHistory ? "Ver menos" : "Ver todo"}</Text>
            </Pressable>
          ) : null}
        </View>
        {model.historyRows.length === 0 ? (
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: mobileTheme.color.bgSurface, padding: 14, gap: 8 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>Todavía no hay registros</Text>
            <Text style={{ color: "#8B94A3", fontSize: 13, lineHeight: 18 }}>Usa `Registrar` para guardar tu primer peso, foto o perímetro corporal.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {model.historyRows.map((row) => (
              <Pressable key={row.measurement.id} testID={`measurement-history-${row.measurement.id}`} onPress={() => actions.editMeasurement(row.measurement)} style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", backgroundColor: mobileTheme.color.bgSurface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "800" }}>{row.dateLabel}</Text>
                  <Text style={{ color: "#7F8795", fontSize: 12, lineHeight: 17 }} numberOfLines={1}>{row.summary}</Text>
                </View>
                {row.delta !== null ? (
                  <View style={{ minHeight: 30, borderRadius: mobileTheme.radius.pill, backgroundColor: row.deltaBackground, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Feather name={row.deltaDecreased ? "trending-down" : "trending-up"} size={11} color={row.deltaColor} />
                    <Text style={{ color: row.deltaColor, fontSize: 12, fontWeight: "800" }}>{formatMeasurementNumber(Math.abs(row.delta))} {model.metricMeta.unit}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#5D6675" />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {model.photos.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "800", fontSize: 20 }}>Fotos de progreso</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {model.photos.map((measurement) => (
              <Pressable key={measurement.id} onPress={() => actions.expandPhoto(measurement.photo_uri)} style={{ width: "31%", aspectRatio: 1, borderRadius: 14, overflow: "hidden" }}>
                <Image source={{ uri: measurement.photo_uri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 6, paddingVertical: 3 }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{formatMeasurementHistoryDate(measurement.measured_on)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const MEASUREMENT_ENTRY_FIELDS = [
  { key: "neck", label: "Cuello (cm)" },
  { key: "chest", label: "Pecho (cm)" },
  { key: "waist", label: "Cintura (cm)" },
  { key: "hips", label: "Cadera (cm)" },
  { key: "biceps", label: "Bíceps (cm)" },
  { key: "quadriceps", label: "Cuádriceps (cm)" },
  { key: "calf", label: "Gemelo (cm)" },
  { key: "height", label: "Altura (cm)" },
] as const;

function BodyFatReferenceTable({ sex }: { sex: "male" | "female" }) {
  const rows = sex === "male"
    ? [
        { age: "Edad", sub: "Sub.", ath: "Atlético", fit: "Saludable", acc: "Aceptable", ob: "Obesidad" },
        { age: "20-29", sub: "<7%", ath: "7-10%", fit: "11-15%", acc: "16-20%", ob: ">20%" },
        { age: "30-39", sub: "<8%", ath: "8-12%", fit: "13-17%", acc: "18-22%", ob: ">22%" },
        { age: "40-49", sub: "<10%", ath: "10-14%", fit: "15-19%", acc: "20-24%", ob: ">24%" },
        { age: "50-59", sub: "<11%", ath: "11-15%", fit: "16-20%", acc: "21-25%", ob: ">25%" },
        { age: "60+", sub: "<12%", ath: "12-17%", fit: "18-21%", acc: "22-26%", ob: ">26%" },
      ]
    : [
        { age: "Edad", sub: "Sub.", ath: "Atlético", fit: "Saludable", acc: "Aceptable", ob: "Obesidad" },
        { age: "20-29", sub: "<14%", ath: "14-17%", fit: "18-22%", acc: "23-27%", ob: ">27%" },
        { age: "30-39", sub: "<15%", ath: "15-18%", fit: "19-23%", acc: "24-28%", ob: ">28%" },
        { age: "40-49", sub: "<17%", ath: "17-20%", fit: "21-25%", acc: "26-30%", ob: ">30%" },
        { age: "50-59", sub: "<18%", ath: "18-22%", fit: "23-27%", acc: "28-32%", ob: ">32%" },
        { age: "60+", sub: "<19%", ath: "19-23%", fit: "24-28%", acc: "29-33%", ob: ">33%" },
      ];
  return (
    <>
      <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>
        {sex === "male" ? "Hombres" : "Mujeres"}
      </Text>
      <View style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {rows.map((row, index) => (
          <View key={row.age} style={{ flexDirection: "row", backgroundColor: index === 0 ? "rgba(255,255,255,0.06)" : index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            {[row.age, row.sub, row.ath, row.fit, row.acc, row.ob].map((cell, cellIndex) => (
              <Text
                key={cellIndex}
                style={{
                  flex: cellIndex === 0 ? 1.2 : 1,
                  color: index === 0 ? "#8B94A3" : cellIndex === 1 ? "#FF4B4B" : cellIndex === 2 ? "#CBFF1A" : cellIndex === 3 ? "#00C66B" : cellIndex === 4 ? "#CBFF1A" : cellIndex === 5 ? "#FF8C00" : mobileTheme.color.textPrimary,
                  fontSize: 10,
                  fontWeight: index === 0 ? "700" : "600",
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  textAlign: "center",
                }}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

export const MeasurementsOverlays = memo(function MeasurementsOverlays({
  model,
  actions,
}: {
  model: Readonly<MeasurementsScreenModel>;
  actions: Readonly<MeasurementsScreenActions>;
}) {
  const { overlays } = model;
  const { entry } = overlays;
  return (
    <>
      {overlays.expandedPhotoUri ? (
        <Pressable
          testID={shellSurfaceTestId("measurement-photo")}
          onPress={() => actions.expandPhoto(null)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.92)",
            zIndex: 999,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image source={{ uri: overlays.expandedPhotoUri }} style={{ width: "90%", height: "80%", borderRadius: 16 }} resizeMode="contain" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 16 }}>Toca para cerrar</Text>
        </Pressable>
      ) : null}

      {entry.visible ? (
        <KeyboardAvoidingView
          testID={shellSurfaceTestId("measurement-entry")}
          behavior={entry.isIos ? "padding" : "height"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: mobileTheme.color.bgApp,
            zIndex: 520,
            elevation: 52,
          }}
        >
          <View style={{ paddingHorizontal: mobileTheme.spacing[4], paddingTop: mobileTheme.spacing[4], paddingBottom: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "800" }}>
                {entry.editingMeasurementId ? "Editar medidas" : "Registrar medidas"}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                {entry.editingMeasurementId ? "Modifica los valores de esta entrada." : "Guarda peso, foto y contornos sin salir de la pestaña `Medidas`."}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={actions.closeEntry} style={{ flex: 1, minHeight: 44, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable testID="measurement-save-primary" onPress={actions.saveEntry} disabled={entry.saveBusy} style={{ flex: 1, minHeight: 44, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", opacity: entry.saveBusy ? 0.6 : 1 }}>
                {entry.saveBusy ? <ActivityIndicator size="small" color="#06090D" /> : (
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>{entry.editingMeasurementId ? "Actualizar" : "Guardar medidas"}</Text>
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingTop: 14, paddingBottom: 120, gap: 12 }} keyboardShouldPersistTaps="handled">
            {entry.error ? <Text style={{ color: "#ff8a8a" }}>{entry.error}</Text> : null}
            <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 12 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                Peso actual: {entry.latestWeightKg !== null ? `${entry.latestWeightKg.toFixed(2)} kg` : "Sin registrar"}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                Altura base: {entry.latestHeightCm !== null ? `${formatMeasurementNumber(entry.latestHeightCm)} cm` : "Sin registrar"}
              </Text>
              {entry.latestWeightMeasuredOn ? (
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                  Última actualización: {formatMeasurementDate(entry.latestWeightMeasuredOn)}
                </Text>
              ) : null}

              <Pressable testID="measurement-date-trigger" onPress={actions.openDatePicker} style={{ minHeight: 44, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>Fecha: {formatMeasurementDate(localDateKey(entry.date))}</Text>
                <Ionicons name="calendar-outline" size={18} color={mobileTheme.color.textSecondary} />
              </Pressable>

              {entry.datePickerOpen ? entry.isWeb ? (
                <TextInput testID={shellSurfaceTestId("measurement-date-picker")} value={entry.dateTextInput} onChangeText={actions.changeDateText} placeholder="AAAA-MM-DD" placeholderTextColor={mobileTheme.color.textSecondary} style={{ minHeight: 44, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: 12, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, fontSize: 14 }} />
              ) : (
                <View testID={shellSurfaceTestId("measurement-date-picker")} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, padding: 8, gap: 8 }}>
                  <DateTimePicker value={entry.date} mode="date" maximumDate={new Date()} display={entry.isIos ? "inline" : "default"} onChange={(event, date) => actions.changeNativeDate(event.type, date)} />
                  {entry.isIos ? (
                    <Pressable onPress={actions.closeDatePicker} style={{ height: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>Cerrar calendario</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Foto de progreso</Text>
                {entry.photoUri ? (
                  <Image testID="measurement-photo-preview" source={{ uri: entry.photoUri }} style={{ width: "100%", height: 180, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp }} />
                ) : (
                  <View style={{ minHeight: 92, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Sin foto seleccionada</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable testID="measurement-photo-upload" onPress={actions.pickPhoto} style={{ flex: 1, minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: "rgba(203,255,26,0.45)", backgroundColor: "rgba(203,255,26,0.10)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                    <Ionicons name="image-outline" size={16} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "700", fontSize: 13 }}>Subir foto</Text>
                  </Pressable>
                  <Pressable onPress={actions.takePhoto} style={{ flex: 1, minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: "rgba(203,255,26,0.45)", backgroundColor: "rgba(203,255,26,0.10)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                    <Ionicons name="camera-outline" size={16} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "700", fontSize: 13 }}>Cámara</Text>
                  </Pressable>
                  {entry.photoUri ? (
                    <Pressable onPress={actions.clearPhoto} style={{ height: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600" }}>Quitar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>Peso (kg)</Text>
                <TextInput testID="measurement-weight-input" style={{ minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 }} value={entry.fields.weight} onChangeText={(value) => actions.changeEntryField("weight", value)} placeholder="—" placeholderTextColor={mobileTheme.color.textSecondary} keyboardType="decimal-pad" />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>% Grasa corporal</Text>
                <TextInput testID="measurement-body-fat-input" style={{ minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 }} value={entry.fields.bodyFat} onChangeText={(value) => actions.changeEntryField("bodyFat", value)} placeholder="—" placeholderTextColor={mobileTheme.color.textSecondary} keyboardType="decimal-pad" />
              </View>
              {MEASUREMENT_ENTRY_FIELDS.map((field) => (
                <View key={field.key} style={{ gap: 2 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>{field.label}</Text>
                  <TextInput testID={`measurement-${field.key}-input`} style={{ minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 }} value={entry.fields[field.key]} onChangeText={(value) => actions.changeEntryField(field.key, value)} placeholder="—" placeholderTextColor={mobileTheme.color.textSecondary} keyboardType="decimal-pad" />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={actions.closeEntry} style={{ flex: 1, minHeight: 44, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={actions.saveEntry} disabled={entry.saveBusy} style={{ flex: 1, minHeight: 44, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", opacity: entry.saveBusy ? 0.6 : 1 }}>
                  {entry.saveBusy ? <ActivityIndicator size="small" color="#06090D" /> : (
                    <Text style={{ color: "#06090D", fontWeight: "700" }}>{entry.editingMeasurementId ? "Actualizar" : "Guardar medidas"}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {overlays.bodyFatInfoOpen ? (
        <View testID={shellSurfaceTestId("body-fat-info")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: 20 }}>
          <View style={{ backgroundColor: "#141820", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 20, width: "100%", maxHeight: "85%" }}>
            <ScrollView>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>% Grasa corporal por edad</Text>
                <Pressable onPress={actions.closeBodyFatInfo} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#8B94A3" />
                </Pressable>
              </View>
              <BodyFatReferenceTable sex="male" />
              <BodyFatReferenceTable sex="female" />
              <Text style={{ color: "#8B94A3", fontSize: 11, lineHeight: 16 }}>
                El cuerpo necesita al menos un 3-5% (hombres) o 10-13% (mujeres) de grasa esencial. Con la edad, es normal tener algo más de grasa. La distribución (visceral vs. subcutánea) también importa.
              </Text>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </>
  );
});
