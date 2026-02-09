import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

type HeatmapProps = {
  data: { date: string; count: number }[];
};

function getClassName(count: number | null | undefined) {
  if (!count) return "color-empty";
  if (count <= 1) return "color-scale-1";
  if (count <= 3) return "color-scale-2";
  if (count <= 6) return "color-scale-3";
  return "color-scale-4";
}

export default function Heatmap({ data }: HeatmapProps) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 5);

  return (
    <div className="heatmap-wrapper">
      <CalendarHeatmap
        startDate={startDate}
        endDate={new Date()}
        values={data}
        classForValue={(value) => getClassName(value?.count)}
        showWeekdayLabels
      />
    </div>
  );
}
