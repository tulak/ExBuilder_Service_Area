import {
  React,
  FormattedMessage,
  Immutable,
  DataSourceManager,
} from "jimu-core";
import { AllWidgetSettingProps } from "jimu-for-builder";
import {
  JimuMapViewSelector,
  SettingSection,
  SettingRow,
} from "jimu-ui/advanced/setting-components";
import { TextInput, NumericInput } from "jimu-ui";
import { ColorPicker } from "jimu-ui/basic/color-picker";

import { IMConfig } from "../config";
import defaultMessages from "./translations/default";

export interface SettingProps extends AllWidgetSettingProps<IMConfig> {}
export interface SettingState {
  hasMapWidget: boolean;
}

const randomHexColor = () => {
  let n = (Math.random() * 0xfffff * 1000000).toString(16);
  return `#${n.slice(0, 6)}`;
};

export default class Setting extends React.Component<
  SettingProps,
  SettingState
> {
  constructor(props: SettingProps) {
    super(props);

    this.state = {
      hasMapWidget:
        Boolean(props.useMapWidgetIds) && props.useMapWidgetIds.length > 0,
    };

    this.handleMapWidgetChange = this.handleMapWidgetChange.bind(this);
    this.handleServiceAreaUrlChange = this.handleServiceAreaUrlChange.bind(
      this
    );
    this.handleRepetitionMaxChange = this.handleRepetitionMaxChange.bind(this);
    this.handleResultColorChange = this.handleResultColorChange.bind(this);
    this.handleFacilityColorChange = this.handleFacilityColorChange.bind(this);
  }

  componentDidMount() {
    const { repetitionMax } = this.props.config;
    this.handleRepetitionMaxChange(repetitionMax);
  }

  componentDidUpdate(prevProps: SettingProps, prevState: SettingState) {}

  render() {
    const { repetitionMax, colors } = this.props.config;

    return (
      <div className="setting-arcdata-service-area">
        <SettingSection
          title={this.props.intl.formatMessage({
            id: "mapWidget",
            defaultMessage: defaultMessages.mapWidget,
          })}
        >
          <SettingRow>
            <JimuMapViewSelector
              onSelect={this.handleMapWidgetChange}
              useMapWidgetIds={this.props.useMapWidgetIds}
            />
          </SettingRow>
        </SettingSection>

        <SettingSection
          title={this.props.intl.formatMessage({
            id: "serviceAreaUrl",
            defaultMessage: defaultMessages.serviceAreaUrl,
          })}
        >
          <SettingRow>
            <TextInput
              className="w-100"
              size="sm"
              value={this.props.config.serviceAreaUrl}
              onBlur={this.handleServiceAreaUrlChange}
            />
          </SettingRow>
        </SettingSection>
        <SettingSection
          title={this.props.intl.formatMessage({
            id: "repetitionMax",
            defaultMessage: defaultMessages.repetitionMax,
          })}
        >
          <SettingRow>
            <NumericInput
              className="w-100"
              size="sm"
              min={1}
              max={10}
              value={this.props.config.repetitionMax}
              onChange={this.handleRepetitionMaxChange}
            />
          </SettingRow>
        </SettingSection>
        <SettingSection
          title={this.props.intl.formatMessage({
            id: "resultColor",
            defaultMessage: defaultMessages.resultColor,
          })}
        >
          <SettingRow>
            {colors.map((color, index) => (
              <ColorPicker
                key={index}
                showArrow={true}
                placement="top"
                color={color}
                onChange={(color) => {
                  this.handleResultColorChange(color, index);
                }}
              />
            ))}
          </SettingRow>
        </SettingSection>
        <SettingSection
          title={this.props.intl.formatMessage({
            id: "facilityColor",
            defaultMessage: defaultMessages.facilityColor,
          })}
        >
          <SettingRow>
            <ColorPicker
              color={
                this.props.config.facilityColor ||
                this.props.theme.colors.primary
              }
              onChange={this.handleFacilityColorChange}
            />
          </SettingRow>
        </SettingSection>
      </div>
    );
  }

  private handleServiceAreaUrlChange(
    event: React.FormEvent<HTMLInputElement>
  ): void {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.set(
        "serviceAreaUrl",
        event.currentTarget.value
      ),
    });
  }

  private handleRepetitionMaxChange(value: number): void {
    const colorsNew = Array.from(Array(value).keys()).map((idx) => {
      return this.props.config.colors[idx]
        ? this.props.config.colors[idx]
        : randomHexColor();
    });
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.merge({
        colors: colorsNew,
        repetitionMax: value,
      }),
    });
  }

  private handleMapWidgetChange(useMapWidgetIds: string[]): void {
    this.setState({
      hasMapWidget: Boolean(useMapWidgetIds) && useMapWidgetIds.length > 0,
    });

    this.props.onSettingChange({
      id: this.props.id,
      useMapWidgetIds: useMapWidgetIds,
    });
  }

  private handleResultColorChange(color: string, index): void {
    const colorsNew = this.props.config.colors.map((c, i) => {
      if (index !== i) {
        return c;
      }
      return color;
    });

    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.set("colors", colorsNew),
    });
  }

  private handleFacilityColorChange(color: string): void {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.set("facilityColor", color),
    });
  }
}
