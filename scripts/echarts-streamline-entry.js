import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    LineChart,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    MarkPointComponent,
    CanvasRenderer
]);

export { echarts };
