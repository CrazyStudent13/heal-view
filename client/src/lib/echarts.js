import * as echarts from 'echarts/core';
import {
  BarChart,
  CustomChart,
  LineChart,
  PieChart,
  ScatterChart
} from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  CanvasRenderer,
  CustomChart,
  GridComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  PieChart,
  ScatterChart,
  TooltipComponent
]);

export default echarts;
