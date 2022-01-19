/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChartConfig, ChartDataSectionType } from 'app/types/ChartConfig';
import ChartDataset from 'app/types/ChartDataset';
import {
  getColumnRenderName,
  getDataColumnMaxAndMin,
  getExtraSeriesRowData,
  getGridStyle,
  getReference,
  getScatterSymbolSizeFn,
  getSeriesTooltips4Scatter,
  getStyles,
  getValueByColumnKey,
  transformToObjectArray,
} from 'app/utils/chartHelper';
import { init } from 'echarts';
import Chart from '../models/Chart';
import Config from './config';

class BasicScatterChart extends Chart {
  dependency = [];
  config = Config;
  chart: any = null;

  constructor() {
    super('scatter', '散点图', 'sandiantu');
    this.meta.requirements = [
      {
        group: [0, 999],
        aggregate: 2,
      },
    ];
  }

  onMount(options, context): void {
    if (options.containerId === undefined || !context.document) {
      return;
    }

    this.chart = init(
      context.document.getElementById(options.containerId),
      'default',
    );
    this.mouseEvents?.forEach(event => {
      this.chart.on(event.name, event.callback);
    });
  }

  onUpdated(props): void {
    if (!props.dataset || !props.dataset.columns || !props.config) {
      return;
    }

    if (!this.isMatchRequirement(props.config)) {
      this.chart?.clear();
      return;
    }
    const newOptions = this.getOptions(props.dataset, props.config);
    this.chart?.setOption(Object.assign({}, newOptions), true);
  }

  onUnMount(): void {
    this.chart?.dispose();
  }

  onResize(opt: any, context): void {
    this.chart?.resize(opt, context);
  }

  private getOptions(dataset: ChartDataset, config: ChartConfig) {
    const objDataColumns = transformToObjectArray(
      dataset.rows,
      dataset.columns,
    );
    const styleConfigs = config.styles;
    const dataConfigs = config.datas || [];
    const settingConfigs = config.settings;
    const groupConfigs = dataConfigs
      .filter(c => c.type === ChartDataSectionType.GROUP)
      .flatMap(config => config.rows || []);
    const aggregateConfigs = dataConfigs
      .filter(c => c.type === ChartDataSectionType.AGGREGATE)
      .flatMap(config => config.rows || []);
    const sizeConfigs = dataConfigs
      .filter(c => c.type === ChartDataSectionType.SIZE)
      .flatMap(config => config.rows || []);
    const infoConfigs = dataConfigs
      .filter(c => c.type === ChartDataSectionType.INFO)
      .flatMap(config => config.rows || []);
    const colorConfigs = dataConfigs
      .filter(c => c.type === ChartDataSectionType.COLOR)
      .flatMap(config => config.rows || []);

    const axisColumns = aggregateConfigs.map(config => {
      return {
        type: 'value',
        name: getValueByColumnKey(config),
      };
    });

    const series = this.getSeriesGroupByColorConfig(
      objDataColumns,
      groupConfigs,
      aggregateConfigs,
      sizeConfigs,
      colorConfigs,
      infoConfigs,
      styleConfigs,
      settingConfigs,
    );

    return {
      tooltip: {
        trigger: 'axis',
        formatter: this.getTooltipFormmaterFunc(
          styleConfigs,
          groupConfigs,
          aggregateConfigs,
          colorConfigs,
          sizeConfigs,
          infoConfigs,
          objDataColumns,
        ),
      },
      legend: this.getLegendStyle(
        styleConfigs,
        series?.map(s => s.name),
      ),
      grid: getGridStyle(styleConfigs),
      xAxis: this.getAxis(styleConfigs, axisColumns[0], 'xAxis'),
      yAxis: this.getAxis(styleConfigs, axisColumns[1], 'yAxis'),
      series,
    };
  }

  protected getSeriesGroupByColorConfig(
    objDataColumns,
    groupConfigs,
    aggregateConfigs,
    sizeConfigs,
    colorConfigs,
    infoConfigs,
    styleConfigs,
    settingConfigs,
  ) {
    const { min, max } = getDataColumnMaxAndMin(objDataColumns, sizeConfigs[0]);
    if (!colorConfigs?.length) {
      return [
        this.getMetricAndSizeSerie(
          {
            max,
            min,
          },
          objDataColumns,
          groupConfigs,
          aggregateConfigs,
          sizeConfigs,
          infoConfigs,
          styleConfigs,
          settingConfigs,
        ),
      ];
    }

    const groupedKey = getValueByColumnKey(colorConfigs?.[0]);
    const colors: Array<{ key; value }> =
      colorConfigs?.[0]?.color?.colors || [];

    const groupedObjDataColumns: {
      [key: string]: { color: string; datas: [] };
    } = objDataColumns?.reduce((acc, cur) => {
      const key = cur?.[groupedKey];
      if (acc?.[key]) {
        acc[key].datas.push(cur);
      } else {
        acc[key] = {
          color: colors?.find(c => c.key === key)?.value,
          datas: [cur],
        };
      }
      return acc;
    }, {});

    return Object.keys(groupedObjDataColumns).map(k => {
      return this.getMetricAndSizeSerie(
        {
          max,
          min,
        },
        groupedObjDataColumns?.[k]?.datas,
        groupConfigs,
        aggregateConfigs,
        sizeConfigs,
        infoConfigs,
        styleConfigs,
        settingConfigs,
        k,
        groupedObjDataColumns?.[k]?.color,
      );
    });
  }

  protected getMetricAndSizeSerie(
    { max, min },
    objDataColumns,
    groupConfigs,
    aggregateConfigs,
    sizeConfigs,
    infoConfigs,
    styleConfigs,
    settingConfigs,
    colorSeriesName?,
    color?,
  ) {
    const [cycleRatio] = getStyles(styleConfigs, ['scatter'], ['cycleRatio']);
    const defaultSizeValue = (max - min) / 2;
    const seriesName = groupConfigs
      ?.map(gc => getColumnRenderName(gc))
      .join('-');
    const seriesDatas = objDataColumns?.map(dc => {
      const sizeValue =
        dc?.[getValueByColumnKey(sizeConfigs?.[0])] || defaultSizeValue;
      return {
        ...getExtraSeriesRowData(dc),
        name: groupConfigs?.map(gc => dc?.[getColumnRenderName(gc)]).join('-'),
        value: aggregateConfigs
          ?.map(aggConfig => dc?.[getValueByColumnKey(aggConfig)])
          .concat(
            infoConfigs?.map(
              infoConfig => dc?.[getValueByColumnKey(infoConfig)],
            ),
          )
          .concat([sizeValue, colorSeriesName]),
      };
    });

    const sizeValueIndex = []
      .concat(aggregateConfigs)
      .concat(infoConfigs)?.length;

    return {
      name: colorSeriesName || seriesName,
      type: 'scatter',
      data: seriesDatas,
      symbolSize: getScatterSymbolSizeFn(sizeValueIndex, max, min, cycleRatio),
      itemStyle: {
        color,
      },
      ...this.getLabelStyle(styleConfigs),
      ...getReference(
        settingConfigs,
        objDataColumns,
        aggregateConfigs?.[1],
        true,
      ),
    };
  }

  private getAxis(styles, xAxisColumn, axisKey) {
    const [
      showAxis,
      inverse,
      lineStyle,
      showLabel,
      font,
      unitFont,
      showTitleAndUnit,
      nameLocation,
      nameGap,
      nameRotate,
      min,
      max,
    ] = getStyles(
      styles,
      [axisKey],
      [
        'showAxis',
        'inverseAxis',
        'lineStyle',
        'showLabel',
        'font',
        'unitFont',
        'showTitleAndUnit',
        'nameLocation',
        'nameGap',
        'nameRotate',
        'min',
        'max',
      ],
    );
    const name = showTitleAndUnit
      ? [xAxisColumn].map(c => c.name).join(' / ')
      : null;
    const splitLineProps =
      axisKey === 'xAxis'
        ? ['showHorizonLine', 'horizonLineStyle']
        : ['showVerticalLine', 'verticalLineStyle'];
    const [showSplitLine, splitLineStyle] = getStyles(
      styles,
      ['splitLine'],
      [splitLineProps[0], splitLineProps[1]],
    );

    return {
      type: 'value',
      inverse,
      name,
      nameLocation,
      nameGap,
      nameRotate,
      min,
      max,
      axisLabel: {
        show: showLabel,
        ...font,
      },
      axisLine: {
        show: showAxis,
        lineStyle,
      },
      axisTick: {
        show: showLabel,
        lineStyle,
      },
      nameTextStyle: unitFont,
      splitLine: {
        show: showSplitLine,
        lineStyle: splitLineStyle,
      },
    };
  }

  private getLegendStyle(styles, seriesNames) {
    const [show, type, font, legendPos, selectAll] = getStyles(
      styles,
      ['legend'],
      ['showLegend', 'type', 'font', 'position', 'selectAll'],
    );
    let positions = {};
    let orient = {};

    switch (legendPos) {
      case 'top':
        orient = 'horizontal';
        positions = { top: 8, left: 8, right: 8, height: 32 };
        break;
      case 'bottom':
        orient = 'horizontal';
        positions = { bottom: 8, left: 8, right: 8, height: 32 };
        break;
      case 'left':
        orient = 'vertical';
        positions = { left: 8, top: 16, bottom: 24, width: 96 };
        break;
      default:
        orient = 'vertical';
        positions = { right: 8, top: 16, bottom: 24, width: 96 };
        break;
    }
    const selected = seriesNames.reduce(
      (obj, name) => ({
        ...obj,
        [name]: selectAll,
      }),
      {},
    );

    return {
      ...positions,
      show,
      type,
      orient,
      selected,
      data: seriesNames,
      textStyle: font,
    };
  }

  private getLabelStyle(styles) {
    const [show, position, font] = getStyles(
      styles,
      ['label'],
      ['showLabel', 'position', 'font'],
    );
    return {
      label: { show, position, ...font, formatter: '{b}' },
      labelLayout: { hideOverlap: true },
    };
  }

  private getTooltipFormmaterFunc(
    styleConfigs,
    groupConfigs,
    aggregateConfigs,
    colorConfigs,
    sizeConfigs,
    infoConfigs,
    dataColumns,
  ) {
    return seriesParams => {
      const tooltips = !!groupConfigs.length
        ? [
            `${groupConfigs?.map(gc => getColumnRenderName(gc)).join('-')}: ${
              seriesParams[0].name
            }`,
          ]
        : [];

      return tooltips
        .concat(
          getSeriesTooltips4Scatter(
            seriesParams,
            []
              .concat(aggregateConfigs)
              .concat(infoConfigs)
              .concat(sizeConfigs)
              .concat(colorConfigs),
          ),
        )
        .join('<br />');
    };
  }
}

export default BasicScatterChart;