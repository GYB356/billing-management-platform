import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  Legend,
} from 'recharts';

interface ChartProps {
  data: any[];
  height?: number;
  className?: string;
}

interface LineChartProps extends ChartProps {
  dataKey: string;
  xAxisKey?: string;
  stroke?: string;
}

export function LineChart({
  data,
  dataKey,
  xAxisKey = 'name',
  stroke = '#8884d8',
  height = 300,
  className,
}: LineChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={stroke} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps extends ChartProps {
  bars: Array<{
    dataKey: string;
    fill?: string;
    name?: string;
  }>;
  xAxisKey?: string;
}

export function BarChart({
  data,
  bars,
  xAxisKey = 'name',
  height = 300,
  className,
}: BarChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              fill={bar.fill || `#${Math.floor(Math.random()*16777215).toString(16)}`}
              name={bar.name || bar.dataKey}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
} 