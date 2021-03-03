/** @jsx jsx */
import {
  AllWidgetProps,
  BaseWidget,
  jsx,
  css,
  React,
  ImmutableArray,
  appActions,
} from "jimu-core";
import { JimuMapViewComponent, JimuMapView } from "jimu-arcgis";
import {
  Form,
  FormGroup,
  Label,
  Select,
  Option,
  TextInput,
  NumericInput,
  WidgetPlaceholder,
  Alert,
} from "jimu-ui";

// import Handles from "esri/core/Handles";
// import GraphicsLayer from "esri/layers/GraphicsLayer";
// import ServiceAreaTask from "esri/tasks/ServiceAreaTask";
// import esriRequest from "esri/request";
// import Search from "esri/widgets/Search";
// import Slider from "esri/widgets/Slider";
// import Graphic from "esri/Graphic";
// import SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
// import Color from "esri/Color";
// import ServiceAreaParameters from "esri/tasks/support/ServiceAreaParameters";
// import FeatureSet from "esri/tasks/support/FeatureSet";
// import SimpleFillSymbol from "esri/symbols/SimpleFillSymbol";
// import {
//   on as watchOn,
// } from "esri/core/watchUtils";
import Handles = require("esri/core/Handles");
import GraphicsLayer = require("esri/layers/GraphicsLayer");
import ServiceAreaTask = require("esri/tasks/ServiceAreaTask");
import esriRequest = require("esri/request");
import Search = require("esri/widgets/Search");
import Slider = require("esri/widgets/Slider");
import Graphic = require("esri/Graphic");
import SimpleMarkerSymbol = require("esri/symbols/SimpleMarkerSymbol");
import Color = require("esri/Color");
import ServiceAreaParameters = require("esri/tasks/support/ServiceAreaParameters");
import FeatureSet = require("esri/tasks/support/FeatureSet");
import SimpleFillSymbol = require("esri/symbols/SimpleFillSymbol");
import watchUtils = require("esri/core/watchUtils");
import promiseUtils = require("esri/core/promiseUtils");

// import "@esri/calcite-components/dist/calcite.js";
// import "@esri/calcite-components/dist/calcite/calcite.css";

import { IMConfig } from "../config";
import defaultMessages from "./translations/default";
import { getStyle } from "./style";

export type Status = "ready" | "loading" | "disabled" | "error" | "info";
export type DateType = "date" | "dayofweek";
export type TravelDirection = "from-facility" | "to-facility";
export interface WidgetProps extends AllWidgetProps<IMConfig> {}
export interface WidgetState {
  status: Status;
  message: string;
  dateType: DateType;
  travelDirection: TravelDirection;
  date: Date;
  hours: number;
  minutes: number;
  daysOfWeek: Date[];
  dayOfWeek: number;
  interval: number;
  repetition: number;
  facility: __esri.Graphic;
  serviceAreas: __esri.Graphic[];
  serviceAreaTaskMetadata: any;
  isSearchFocus: boolean;
}

const randomHexColor = () => {
  let n = (Math.random() * 0xfffff * 1000000).toString(16);
  return `#${n.slice(0, 6)}`;
};

const widgetIcon = require("./assets/icon.svg");

const HANDLES_REGISTRY = {
  viewClick: "view-click",
  viewDrag: "view-drag",
  viewPointerDown: "view-pointer-down",
  viewPointerUp: "view-pointer-up",
  viewPointerMove: "view-pointer-move",
  search: "search",
  slider: "slider",
  facility: "facility",
  serviceAreas: "service-areas",
};

const toLocaleDateString = (d: Date): string => {
  return Boolean(d)
    ? d.getFullYear() +
        "-" +
        ("0" + (d.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + d.getDate()).slice(-2)
    : "";
};

const toLocaleTimeString = (hours: number, minutes: number): string => {
  return hours >= 0 && minutes >= 0
    ? `0${hours}`.slice(-2) + ":" + `0${minutes}`.slice(-2)
    : "";
};

export default class Widget extends React.Component<WidgetProps, WidgetState> {
  private searchContainer: React.RefObject<HTMLDivElement>;
  private sliderContainer: React.RefObject<HTMLDivElement>;
  private mapView: __esri.MapView | __esri.SceneView;
  private jimuMapView: JimuMapView;
  private handles: __esri.Handles;
  private graphicsLayerServiceArea: __esri.GraphicsLayer;
  private graphicsLayerFacility: __esri.GraphicsLayer;
  private serviceAreaTask: ServiceAreaTask;
  private solveAbortController: AbortController;
  private initAbortController: AbortController;
  private search: Search;
  private slider: Slider;
  private symbolFacility: __esri.SimpleMarkerSymbol;
  private symbolFacilitySelected: __esri.SimpleMarkerSymbol;
  private tooltip: any;

  constructor(props) {
    super(props);

    this.searchContainer = React.createRef<HTMLDivElement>();
    this.sliderContainer = React.createRef<HTMLDivElement>();
    this.handles = new Handles();
    this.symbolFacility = new SimpleMarkerSymbol({
      path:
        "M24 12h-3.225A8.287 8.287 0 0 0 13 4.225V1h-1v3.225A8.287 8.287 0 0 0 4.225 12H1v.955h3.223A8.287 8.287 0 0 0 12 20.775V24h1v-3.225A8.287 8.287 0 0 0 20.775 13H24zm-11.5 7.8a7.3 7.3 0 1 1 7.3-7.3 7.308 7.308 0 0 1-7.3 7.3zm4.5-7.3A4.5 4.5 0 1 1 12.5 8a4.506 4.506 0 0 1 4.5 4.5z",
      outline: {
        color: props.config.facilityColor,
      },
      size: 12,
    });

    this.symbolFacilitySelected = new SimpleMarkerSymbol({
      path:
        "M5 15V9l-3.75 3zm-1-2.08L2.85 12 4 11.08zM22.75 12L19 9v6zM20 11.08l1.15.92-1.15.92zM15 5l-3-3.75L9 5zm-2.081-1h-1.838L12 2.85zM15 19H9l3 3.75zm-2.081 1L12 21.15 11.081 20zM17 7H7v10h10zm-1 9H8V8h8z",
      outline: {
        color: props.config.facilityColor,
      },
      size: 18,
    });

    this.state = {
      status: "loading",
      message: null,
      dateType: "date",
      travelDirection: "from-facility",
      date: new Date(),
      hours: new Date().getHours(),
      minutes: new Date().getMinutes(),
      daysOfWeek: Array.from(Array(7).keys()).map((value) => {
        return new Date(1990, 0, value + 1);
      }),
      dayOfWeek: this.props.config.dayOfWeek,
      interval: this.props.config.interval,
      repetition: this.props.config.repetition,
      facility: null,
      serviceAreas: null,
      serviceAreaTaskMetadata: null,
      isSearchFocus: false,
    };

    this.handleUseMapWidgetIdsChange = this.handleUseMapWidgetIdsChange.bind(
      this
    );
    this.handleActiveViewChange = this.handleActiveViewChange.bind(this);
    this.handleSearchBlur = this.handleSearchBlur.bind(this);
    this.handleSearchClear = this.handleSearchClear.bind(this);
    this.handleSearchFocus = this.handleSearchFocus.bind(this);
    this.handleSearchResult = this.handleSearchResult.bind(this);
    this.handleSearchComplete = this.handleSearchComplete.bind(this);
    this.handleViewClick = this.handleViewClick.bind(this);
    this.handleFacilityChange = this.handleFacilityChange.bind(this);
    this.handleDateChange = this.handleDateChange.bind(this);
    this.handleDayOfWeekChange = this.handleDayOfWeekChange.bind(this);
    this.handleTimeChange = this.handleTimeChange.bind(this);
    this.handleIntervalChange = this.handleIntervalChange.bind(this);
    this.handleRepetitionChange = this.handleRepetitionChange.bind(this);
    this.handleResultColorsChange = this.handleResultColorsChange.bind(this);
    this.handleFacilityColorChange = this.handleFacilityColorChange.bind(this);
  }

  componentDidMount() {
    this.createServiceAreaTask();
  }

  componentWillUnmout() {
    this.handles.removeAll();
    this.handles = null;
    this.disableTooltip();
    if (this.mapView) {
      this.destroyGraphicsLayers();
      this.mapView = null;
      this.jimuMapView = null;
    }

    if (this.search && !this.search.destroyed) {
      this.search.destroy();
      this.search = null;
    }

    if (this.slider && !this.slider.destroyed) {
      this.slider.destroy();
      this.slider = null;
    }
  }

  componentDidUpdate(prevProps: WidgetProps, prevState: WidgetState) {
    if (this.props.useMapWidgetIds !== prevProps.useMapWidgetIds) {
      this.handleUseMapWidgetIdsChange(
        this.props.useMapWidgetIds,
        prevProps.useMapWidgetIds
      );
    }

    if (this.props.config.serviceAreaUrl !== prevProps.config.serviceAreaUrl) {
      this.createServiceAreaTask();
    }

    if (this.props.config.colors !== prevProps.config.colors) {
      this.handleResultColorsChange(this.props.config.colors.asMutable());
    }

    if (this.props.config.facilityColor !== prevProps.config.facilityColor) {
      this.handleFacilityColorChange(
        prevProps.config.facilityColor,
        this.props.config.facilityColor
      );
    }

    if (this.state.facility !== prevState.facility) {
      this.handleFacilityChange(prevState.facility, this.state.facility);
    }

    if (this.state.serviceAreas !== prevState.serviceAreas) {
      this.handleServiceAreasChange(
        prevState.serviceAreas,
        this.state.serviceAreas
      );
    }

    if (
      this.state.facility !== prevState.facility ||
      this.state.dateType !== prevState.dateType ||
      this.state.date !== prevState.date ||
      this.state.hours !== prevState.hours ||
      this.state.minutes !== prevState.minutes ||
      this.state.dayOfWeek !== prevState.dayOfWeek ||
      this.state.interval !== prevState.interval ||
      this.state.repetition !== prevState.repetition ||
      this.state.travelDirection !== prevState.travelDirection
    ) {
      this.isValid() ? this.solve() : this.clear();
    }
  }

  render() {
    if (!this.isMapConfigured() || !this.isServiceAreaTaskConfigured()) {
      return (
        <div className="jimu-widget" css={getStyle(this.props.theme)}>
          <div className="arcdata-service-area">
            <WidgetPlaceholder
              icon={widgetIcon}
              autoFlip
              message={this.props.intl.formatMessage({
                id: !this.isMapConfigured()
                  ? "missingMapWidget"
                  : !this.isServiceAreaTaskConfigured()
                  ? "incorrectServiceAreaUrl"
                  : "_widgetLabel",
                defaultMessage: !this.isMapConfigured()
                  ? defaultMessages.missingMapWidget
                  : !this.isServiceAreaTaskConfigured()
                  ? defaultMessages.incorrectServiceAreaUrl
                  : defaultMessages._widgetLabel,
              })}
              widgetId={this.props.id}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="jimu-widget" css={getStyle(this.props.theme)}>
        <div className="arcdata-service-area">
          {this.renderLoading()}
          {this.renderSearch()}
          {this.renderDate()}
          {this.renderTime()}
          {this.renderInterval()}
          {this.renderRepetition()}
          {this.renderFooter()}
          {/* {this.state.status === "info" ? <Alert color="info">${this.state.message}</Alert> : null} */}
        </div>
        <JimuMapViewComponent
          useMapWidgetIds={this.props.useMapWidgetIds}
          onActiveViewChange={this.handleActiveViewChange}
        />
      </div>
    );
  }

  renderTime(): any {
    const { hours, minutes } = this.state;

    return (
      <FormGroup>
        <Label for="time">
          {this.props.intl.formatMessage({
            id: "time",
            defaultMessage: defaultMessages.time,
          })}
        </Label>
        <TextInput
          id="time"
          size="sm"
          type="time"
          value={toLocaleTimeString(hours, minutes)}
          onBlur={this.handleTimeChange}
        />
      </FormGroup>
    );
  }

  renderDate(): any {
    const { dateType, date, dayOfWeek, daysOfWeek } = this.state;
    const { theme } = this.props;

    const styleLabelDate = css`
      color: ${dateType === "date" ? theme.colors.primary : "inherit"};
      cursor: ${dateType === "date" ? "default" : "pointer"};
      font-weight: ${dateType === "date" ? "bold" : "normal"};
      display: contents;
    `;

    const styleLabelDayOfWeek = css`
      color: ${dateType === "dayofweek" ? theme.colors.primary : "inherit"};
      cursor: ${dateType === "dayofweek" ? "default" : "pointer"};
      font-weight: ${dateType === "dayofweek" ? "bold" : "normal"};
      display: contents;
    `;

    return (
      <FormGroup>
        <Label for="date">
          <a
            css={styleLabelDate}
            className="text-decoration-none"
            onClick={() => this.handleDateTypeChange("date")}
            href="javascript:;"
          >
            {this.props.intl.formatMessage({
              id: "date",
              defaultMessage: defaultMessages.date,
            })}
          </a>
          &nbsp;/&nbsp;
          <a
            css={styleLabelDayOfWeek}
            className="text-decoration-none"
            onClick={() => this.handleDateTypeChange("dayofweek")}
            href="javascript:;"
          >
            {this.props.intl.formatMessage({
              id: "dayOfWeek",
              defaultMessage: defaultMessages.dayOfWeek,
            })}
          </a>
        </Label>
        {dateType === "date" ? (
          // <DatePicker
          //   id="date"
          //   locale="cs-CZ"
          //   startDate={this.state.date}
          //   onChange={this.handleDateChange}
          // />
          <TextInput
            id="date"
            size="sm"
            type="date"
            value={toLocaleDateString(date)}
            onBlur={this.handleDateChange}
          />
        ) : (
          <Select
            id="date"
            size="sm"
            value={dayOfWeek}
            onChange={this.handleDayOfWeekChange}
          >
            {daysOfWeek.map((date, index) => {
              return (
                <Option
                  key={index}
                  aria-label={this.props.intl.formatDate(date, {
                    weekday: "long",
                  })}
                  value={index}
                >
                  {this.props.intl.formatDate(date, { weekday: "long" })}
                </Option>
              );
            })}
          </Select>
        )}
      </FormGroup>
    );
  }

  renderSearch(): any {
    const { travelDirection } = this.state;
    const { theme } = this.props;

    const styleLabelFromFacility = css`
      color: ${travelDirection === "from-facility"
        ? theme.colors.primary
        : "inherit"};
      cursor: ${travelDirection === "from-facility" ? "default" : "pointer"};
      font-weight: ${travelDirection === "from-facility" ? "bold" : "normal"};
      display: contents;
    `;
    const styleLabelToFacility = css`
      color: ${travelDirection === "to-facility"
        ? theme.colors.primary
        : "inherit"};
      cursor: ${travelDirection === "to-facility" ? "default" : "pointer"};
      font-weight: ${travelDirection === "to-facility" ? "bold" : "normal"};
      display: contents;
    `;

    return (
      <FormGroup>
        <Label for="search">
          <a
            css={styleLabelFromFacility}
            className="text-decoration-none"
            onClick={() => this.handleTravelDirectionChange("from-facility")}
            href="javascript:;"
          >
            {this.props.intl.formatMessage({
              id: "travelDirectionFromFacility",
              defaultMessage: defaultMessages.travelDirectionFromFacility,
            })}
          </a>
          &nbsp;/&nbsp;
          <a
            css={styleLabelToFacility}
            className="text-decoration-none"
            onClick={() => this.handleTravelDirectionChange("to-facility")}
            href="javascript:;"
          >
            {this.props.intl.formatMessage({
              id: "travelDirectionToFacility",
              defaultMessage: defaultMessages.travelDirectionToFacility,
            })}
          </a>
          &nbsp;
          {this.state.isSearchFocus
            ? `(${this.props.intl.formatMessage({
                id: "mapClick",
                defaultMessage: defaultMessages.mapClick,
              })})`
            : null}
        </Label>
        <div id="search" className="w-100" ref={this.searchContainer}></div>
      </FormGroup>
    );
  }

  renderInterval(): any {
    return (
      <FormGroup>
        <Label for="interval">
          {this.props.intl.formatMessage({
            id: "interval",
            defaultMessage: defaultMessages.interval,
          })}
        </Label>
        <div id="interval" className="w-100" ref={this.sliderContainer} />
      </FormGroup>
    );
  }

  renderRepetition(): any {
    const { repetition } = this.state;
    const { repetitionMax, repetitionMin } = this.props.config;
    return repetitionMax > 1 ? (
      <FormGroup>
        <Label for="repetition">
          {this.props.intl.formatMessage({
            id: "repetition",
            defaultMessage: defaultMessages.repetition,
          })}
        </Label>
        <NumericInput
          id="repetition"
          size="sm"
          min={repetitionMin}
          max={repetitionMax}
          type="number"
          value={repetition}
          onChange={this.handleRepetitionChange}
        />
      </FormGroup>
    ) : null;
  }

  renderLoading(): any {
    const { status } = this.state;
    return status === "loading" ? (
      <div className="arcdata-service-area__loader">
        <div
          style={{ position: "absolute", left: "50%", top: "50%" }}
          className="jimu-secondary-loading"
        />
      </div>
    ) : null;
  }

  renderFooter(): any {
    const date = this.gtfsTime();
    return Boolean(date) ? (
      <div className="clearfix">
        <div className="font-italic pt-5 text-sm-right text-muted small">
          {`${this.props.intl.formatMessage({
            id: "lastDataUpdate",
            defaultMessage: defaultMessages.lastDataUpdate,
          })}: ${this.props.intl.formatDate(date)}`}
        </div>
      </div>
    ) : null;
  }

  clear(): void {
    if (this.solveAbortController) {
      this.solveAbortController.abort();
      this.solveAbortController = null;
    }

    this.setState({
      serviceAreas: null,
      status: "ready",
      message: null,
    });
  }

  solve(): void {
    if (this.solveAbortController) {
      this.solveAbortController.abort();
    }
    const params = new ServiceAreaParameters({
      travelMode: this.travelMode(),
      impedanceAttribute: this.impedance(),
      defaultBreaks: this.breaks(),
      travelDirection: this.state.travelDirection,
      timeOfDay: this.timeOfDay(),
      outSpatialReference: this.mapView.spatialReference,
      facilities: new FeatureSet({
        features: [this.state.facility],
      }),
      outputGeometryPrecision: 0,
      outputGeometryPrecisionUnits: "meters",
      mergeSimilarPolygonRanges: false,
      useHierarchy: false,
      overlapPolygons: true,
      outputPolygons: "simplified",
      splitPolygonsAtBreaks: true,
      excludeSourcesFromPolygons: ["LineVariantElements"],
      trimOuterPolygon: true,
      trimPolygonDistance: 200,
      trimPolygonDistanceUnits: "meters",
    });

    this.solveAbortController = new AbortController();
    this.setState({
      serviceAreas: null,
      status: "loading",
      message: null,
    });

    this.serviceAreaTask
      .solve(params, {
        signal: this.solveAbortController.signal,
      })
      .then((result) => {
        if (Boolean(result.serviceAreaPolygons)) {
          const graphics: Graphic[] = result.serviceAreaPolygons
            .sort((graphic1, graphic2) => {
              return graphic1.attributes.ToBreak < graphic2.attributes.ToBreak
                ? -1
                : 1;
            })
            .map<Graphic>((graphic, index) => {
              graphic.symbol = new SimpleFillSymbol({
                color: new Color(
                  this.props.config.colors[index]
                    ? this.props.config.colors[index]
                    : randomHexColor()
                ),
                style: "solid",
                outline: null,
              });
              graphic.attributes.Name = `${graphic.attributes.FromBreak} - ${graphic.attributes.ToBreak} min`;

              return graphic;
            })
            .reverse();
          this.setState({
            status: "ready",
            serviceAreas: graphics,
          });
        } else {
          this.setState({
            status: "info",
            message: "Empty solve result",
          });
        }

        this.solveAbortController = null;
      })
      .catch((error) => {
        if (
          error.name === "AbortError" &&
          this.solveAbortController &&
          !this.solveAbortController.signal.aborted
        ) {
          return;
        }
        this.solveAbortController = null;
        this.setState({
          status: "info",
          message: error.message,
        });
      });
  }

  createServiceAreaTask(): void {
    const { serviceAreaUrl } = this.props.config;
    if (this.initAbortController) {
      this.initAbortController.abort();
      this.initAbortController = null;
    }

    this.serviceAreaTask = null;
    this.setState({
      status: "loading",
      serviceAreaTaskMetadata: null,
      message: null,
    });

    this.initAbortController = new AbortController();
    esriRequest(serviceAreaUrl, {
      responseType: "json",
      query: {
        f: "json",
      },
      signal: this.initAbortController.signal,
    })
      .then((response) => {
        // TODO: validate the required settings from the metadata
        if (response.data.layerType !== "esriNAServerServiceAreaLayer") {
          throw new Error("Incorrect Service Area URL");
        }
        this.serviceAreaTask = new ServiceAreaTask({
          url: serviceAreaUrl,
        });
        this.initAbortController = null;
        this.setState({
          status: "ready",
          serviceAreaTaskMetadata: response.data,
          message: null,
        });
      })
      .catch((error) => {
        if (
          error.message === "AbortError" &&
          this.initAbortController &&
          !this.initAbortController.signal.aborted
        ) {
          return;
        }
        this.initAbortController = null;
        this.setState({
          status: "error",
          message: error.message,
        });
      });
  }

  createSlider(): void {
    if (this.slider && !this.slider.destroyed) {
      this.slider.destroy();
      this.slider = null;
      this.handles.remove(HANDLES_REGISTRY.slider);
    }

    if (!(Boolean(this.mapView) && Boolean(this.sliderContainer.current))) {
      return;
    }

    const container = document.createElement("div");
    container.className = "w-100";
    this.sliderContainer.current.appendChild(container);

    this.slider = new Slider({
      container,
      min: this.props.config.intervalMin,
      max: this.props.config.intervalMax,
      steps: this.props.config.intervalStep,
      values: [this.state.interval],
      snapOnClickEnabled: true,
      visibleElements: {
        labels: false,
        rangeLabels: false,
      },
      tickConfigs: [
        {
          mode: "count",
          values:
            this.props.config.intervalMax / this.props.config.intervalStep,
          labelsVisible: true,
        },
      ],
    });
    this.handles.add(
      this.slider.on("thumb-drag", (event: any) => {
        if (event.state === "stop") {
          this.handleIntervalChange(event.value);
        }
      }),
      HANDLES_REGISTRY.slider
    );
  }

  createSearch(): void {
    if (this.search && !this.search.destroyed) {
      this.search.destroy();
      this.search = null;
      this.handles.remove(HANDLES_REGISTRY.search);
    }

    if (!(Boolean(this.mapView) && Boolean(this.searchContainer.current))) {
      return;
    }

    const container = document.createElement("div");
    container.className = "esri-input w-100";
    this.searchContainer.current.appendChild(container);

    this.search = new Search({
      container,
      view: this.mapView,
      resultGraphicEnabled: false,
      popupEnabled: false,
      autoSelect: false,
      minSuggestCharacters: 2,
      maxResults: 5,
      includeDefaultSources: true,
    });
    this.handles.add(
      [
        // watchUtils.on(this.search, "allSources", "change", () =>
        //   this.search.allSources.forEach(source => {
        //     if (
        //       "locator" in source &&
        //       source.locator &&
        //       source.locationType === null
        //     ) {
        //       source.locationType = "street";
        //     }
        //   })
        // ),
        this.search.on("select-result", this.handleSearchResult),
        this.search.on("search-focus", this.handleSearchFocus),
        this.search.on("search-blur", this.handleSearchBlur),
        this.search.on("search-clear", this.handleSearchClear),
        this.search.on("search-complete", this.handleSearchComplete),
      ],
      HANDLES_REGISTRY.search
    );
  }

  gtfsTime(): Date {
    const { supportedTravelModes } = this.state.serviceAreaTaskMetadata || {
      supportedTravelModes: null,
    };
    if (Boolean(supportedTravelModes) && supportedTravelModes.length) {
      const description = supportedTravelModes[0].description as string;
      return new Date(description.substring(2, 12));
    } else {
      return null;
    }
  }

  travelMode(): string {
    const { defaultTravelMode } = this.state.serviceAreaTaskMetadata;
    return defaultTravelMode;
  }

  impedance(): string {
    const { impedance } = this.state.serviceAreaTaskMetadata;
    return impedance;
  }

  breaks(): number[] {
    const breaks: number[] = Array.from(Array(this.state.repetition)).map(
      (value, index) => {
        return (index + 1) * this.state.interval;
      }
    );
    return breaks;
  }

  timeOfDay(): Date {
    if (
      this.state.dateType === "date" &&
      (!Boolean(this.state.date) ||
        this.state.date.getTime() !== this.state.date.getTime())
    ) {
      return null;
    }
    const timeOfDay =
      this.state.dateType === "date"
        ? new Date(this.state.date.getTime())
        : new Date(this.state.daysOfWeek[this.state.dayOfWeek].getTime());
    timeOfDay.setMilliseconds(0);
    timeOfDay.setSeconds(0);
    timeOfDay.setMinutes(this.state.minutes >= 0 ? this.state.minutes : 0);
    timeOfDay.setHours(this.state.hours >= 0 ? this.state.hours : 0);
    return timeOfDay;
  }

  isValid(): boolean {
    return (
      Boolean(this.state.facility) &&
      ((this.state.dateType === "date" &&
        Boolean(this.state.date) &&
        this.state.date.getTime() === this.state.date.getTime()) ||
        this.state.dateType === "dayofweek") &&
      !isNaN(this.state.hours) &&
      !isNaN(this.state.minutes)
    );
  }

  isMapConfigured(): boolean {
    return (
      Boolean(this.props.useMapWidgetIds) &&
      this.props.useMapWidgetIds.length === 1
    );
  }

  isServiceAreaTaskConfigured(): boolean {
    return (
      Boolean(this.serviceAreaTask) &&
      Boolean(this.state.serviceAreaTaskMetadata)
    );
  }

  private destroyGraphicsLayers(): void {
    this.handles.remove(HANDLES_REGISTRY.serviceAreas);
    if (this.mapView) {
      this.mapView.map?.removeMany([
        this.graphicsLayerFacility,
        this.graphicsLayerServiceArea,
      ]);
    }
    this.graphicsLayerFacility = null;
    this.graphicsLayerServiceArea = null;
  }

  private createGraphicsLayers(): void {
    this.graphicsLayerFacility = new GraphicsLayer({
      title: this.props.intl.formatMessage({
        id: "facility",
        defaultMessage: defaultMessages.facility,
      }),
      listMode: "hide",
    });
    this.graphicsLayerServiceArea = new GraphicsLayer({
      title: this.props.intl.formatMessage({
        id: "serviceArea",
        defaultMessage: defaultMessages.serviceArea,
      }),
      listMode: "hide",
    });

    this.handles.add(
      this.graphicsLayerServiceArea.on(
        "layerview-create",
        (event: __esri.GraphicsLayerLayerviewCreateEvent) => {
          this.tooltip = this.enableTooltip(
            event.view as __esri.MapView,
            event.layerView as __esri.GraphicsLayerView,
            "Name"
          );
        }
      ),
      HANDLES_REGISTRY.serviceAreas
    );
    this.handles.add(
      this.graphicsLayerServiceArea.on(
        "layerview-destroy",
        (event: __esri.GraphicsLayerLayerviewDestroyEvent) => {
          this.disableTooltip();
        }
      ),
      HANDLES_REGISTRY.serviceAreas
    );
  }

  private handleUseMapWidgetIdsChange(
    useMapWidgetIds: ImmutableArray<string>,
    prevUseMapWidgetIds: ImmutableArray<string>
  ) {
    if (!Boolean(useMapWidgetIds) || useMapWidgetIds.length === 0) {
      this.disableTooltip();
      this.destroyGraphicsLayers();
      this.handles.removeAll();
      this.mapView = null;
      this.jimuMapView = null;
      this.setState({
        status: "ready",
        facility: null,
        serviceAreas: null,
        message: null,
      });
    }
  }

  private handleActiveViewChange(jimuMapView: JimuMapView): void {
    if (Boolean(this.mapView)) {
      this.disableTooltip();
      this.destroyGraphicsLayers();
      this.handles.removeAll();
      this.search?.destroy();
      this.slider?.destroy();
      this.mapView = null;
      this.jimuMapView = null;
      this.setState({
        status: "ready",
        facility: null,
        serviceAreas: null,
        message: null,
      });
    }

    if (!(Boolean(jimuMapView) && Boolean(jimuMapView.view))) {
      return;
    }

    this.jimuMapView = jimuMapView;
    this.mapView = jimuMapView.view;
    this.createSearch();
    this.createSlider();
    this.createGraphicsLayers();
  }

  private handleSearchComplete(event: any): void {
    this.search.activeMenu = "none";
    let facility: Graphic = null;
    if (event.numResults > 0) {
      // facility = event.results[0].results[0].feature.clone();
      facility = event.results.reduce((facility, result) => {
        if (result.results && result.results.length > 0) {
          facility = result.results.reduce((facility, result) => {
            if (result.feature) {
              facility = result.feature.clone();
            }
            return facility;
          }, null);
        }
        return facility;
      }, null);
      // facility.attributes = {
      //   Name: event.results[0].results[0].name,
      // };
      facility.symbol = this.symbolFacility;
    }

    this.setState({
      facility,
    });
  }

  private handleSearchResult(event: any): void {
    this.search.activeMenu = "none";
    const facility: Graphic = event.result.feature.clone();
    facility.attributes = {
      Name: event.result.name,
    };
    facility.symbol = this.symbolFacility;

    this.setState({
      facility,
    });
  }

  private handleSearchClear(): void {
    this.search.focus();
    this.setState({
      facility: null,
    });
  }

  private handleSearchFocus(): void {
    this.handles.add(
      this.mapView.on("click", this.handleViewClick),
      HANDLES_REGISTRY.viewClick
    );

    this.setState({
      isSearchFocus: true,
    });
  }

  private handleSearchBlur(): void {
    setTimeout(() => {
      this.handles.remove(HANDLES_REGISTRY.viewClick);
      this.search.activeMenu = "none";
    }, 500);

    this.setState({
      isSearchFocus: false,
    });
  }

  private handleViewClick(event: any): void {
    this.search.search(event.mapPoint);
  }

  private handleServiceAreasChange(
    prevServiceAreas: Graphic[],
    serviceAreas: Graphic[]
  ): void {
    if (
      Boolean(prevServiceAreas) &&
      prevServiceAreas.length > 0 &&
      Boolean(this.mapView)
    ) {
      this.graphicsLayerServiceArea.removeAll();
      this.mapView.map.remove(this.graphicsLayerServiceArea);
    }
    if (
      !Boolean(serviceAreas) ||
      serviceAreas.length === 0 ||
      !Boolean(this.mapView)
    ) {
      return;
    }

    this.graphicsLayerServiceArea.addMany(serviceAreas);
    this.mapView.map.add(
      this.graphicsLayerServiceArea,
      this.mapView.map.layers.indexOf(this.graphicsLayerFacility)
    );
  }

  private handleFacilityChange(prevFacility: Graphic, facility: Graphic): void {
    this.handles.remove(HANDLES_REGISTRY.viewPointerMove);
    this.handles.remove(HANDLES_REGISTRY.viewDrag);
    this.handles.remove(HANDLES_REGISTRY.viewPointerDown);
    this.handles.remove(HANDLES_REGISTRY.viewPointerUp);
    if (prevFacility && this.mapView) {
      this.graphicsLayerFacility.removeAll();
      this.mapView.map.remove(this.graphicsLayerFacility);
    }
    if (!Boolean(facility) || !Boolean(this.mapView)) {
      return;
    }
    this.graphicsLayerFacility.add(this.state.facility);
    this.mapView.map.add(this.graphicsLayerFacility);
    this.mapView.goTo({
      center: this.state.facility.geometry,
    });

    this.handles.add(
      this.mapView.on("pointer-move", (event) => {
        this.mapView.hitTest(event).then((response) => {
          if (response.results.length) {
            if (
              response.results.filter((result) => {
                return result.graphic === facility;
              }).length
            ) {
              facility.symbol = this.symbolFacilitySelected;
              this.mapView.container.style.cursor = "pointer";
            } else {
              facility.symbol = this.symbolFacility;
              this.mapView.container.style.cursor = "default";
            }
          }
        });
      }),
      HANDLES_REGISTRY.viewPointerMove
    );

    this.handles.add(
      this.mapView.on("pointer-down", (event) => {
        this.mapView.hitTest(event).then((response) => {
          if (response.results.length) {
            if (
              response.results.filter((result) => {
                return result.graphic === facility;
              }).length
            ) {
              this.handles.add(
                this.mapView.on("drag", (event) => {
                  event.stopPropagation();
                  this.mapView.popup.close();
                  facility.geometry = this.mapView.toMap({
                    x: event.x,
                    y: event.y,
                  });
                }),
                HANDLES_REGISTRY.viewDrag
              );

              this.handles.add(
                this.mapView.on("pointer-up", (event) => {
                  this.handles.remove(HANDLES_REGISTRY.viewDrag);
                  this.handles.remove(HANDLES_REGISTRY.viewPointerUp);
                  this.search.search(facility.geometry);
                }),
                HANDLES_REGISTRY.viewPointerUp
              );
            }
          }
        });
      }),
      HANDLES_REGISTRY.viewPointerDown
    );
  }

  private handleTravelDirectionChange(value: TravelDirection): void {
    this.setState({
      travelDirection: value,
    });
    this.search.focus();
  }

  private handleDateTypeChange(value: DateType): void {
    this.setState({
      dateType: value,
    });
  }

  private handleDateChange(event: any): void {
    const date = Boolean(event.target.value)
      ? new Date(event.target.value)
      : null;
    this.setState({
      date,
    });
  }

  private handleDayOfWeekChange(event: any): void {
    this.setState({
      dayOfWeek: Number(event.target.value),
    });
  }

  private handleTimeChange(event: any): void {
    const hoursAndMinutes = Boolean(event.target.value)
      ? event.target.value.split(":")
      : [];
    const [hours, minutes] = hoursAndMinutes;
    this.setState({
      hours,
      minutes,
    });
  }

  private handleIntervalChange(value: number): void {
    const { repetition } = this.state;
    const { maxTravelTime, intervalStep } = this.props.config;

    this.setState({
      interval: value,
    });

    if(repetition * value > maxTravelTime) {
      const newRepetition = Math.ceil((maxTravelTime / value) / intervalStep) * intervalStep;
      this.setState({
        repetition: Number(newRepetition),
      });
    }
  }

  private handleRepetitionChange(value: number): void {
    const { interval } = this.state;
    const { maxTravelTime, intervalStep } = this.props.config;

    this.setState({
      repetition: Number(value),
    });

    if(interval * value > maxTravelTime) {
      const newInterval = Math.ceil((maxTravelTime / value) / intervalStep) * intervalStep;
      this.setState({
        interval: Number(newInterval),
      });
    }
  }

  private handleResultColorsChange(colors: string[]): void {
    const { serviceAreas } = this.state;
    if (serviceAreas && serviceAreas.length > 0) {
      const serviceAreasNew = serviceAreas
        .reverse()
        .map((serviceArea, index) => {
          const serviceAreaNew = serviceArea.clone();
          serviceAreaNew.symbol.color = new Color(colors[index]);
          return serviceAreaNew;
        })
        .reverse();
      this.setState({
        serviceAreas: serviceAreasNew,
      });
    }
  }

  private handleFacilityColorChange(prevColor: string, color: string): void {
    const { facility } = this.state;
    if (facility) {
      const facilityNew = facility.clone();
      facilityNew.symbol.set("outline", { color });
      this.setState({
        facility: facilityNew,
      });
    }

    this.symbolFacility.outline.set("color", color);
    this.symbolFacilitySelected.outline.set("color", color);
  }

  private createTooltip(view: __esri.MapView): any {
    const tooltip = document.createElement("div");
    const textElement = document.createElement("div");
    tooltip.setAttribute(
      "style",
      `
      position: absolute;
      transition: opacity 200ms;
      pointer-events: none;
    `
    );
    textElement.setAttribute(
      "style",
      `
      margin: 0 auto;
      padding: 5px;
      border-radius: 1px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      transform: translate3d(-50%, -135%, 0);
      background-color: rgba(255, 255, 255, 0.8);
      color: #333;
      border-color: #ccc;
      border-style: solid;
      border-width: 1px;
      font-size: 0.9em;
    `
    );
    tooltip.setAttribute("role", "tooltip");
    // tooltip.classList.add("tooltip");
    textElement.classList.add("esri-widget");
    tooltip.appendChild(textElement);
    view.container.appendChild(tooltip);

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let visible = false;
    const { style } = tooltip;

    function move() {
      x += (targetX - x) * 0.1;
      y += (targetY - y) * 0.1;

      if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
        x = targetX;
        y = targetY;
      } else {
        requestAnimationFrame(move);
      }

      style.transform =
        "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px, 0)";
    }

    return {
      show: (point, text) => {
        if (!visible) {
          x = point.x;
          y = point.y;
        }

        targetX = point.x;
        targetY = point.y;
        style.opacity = "1";
        visible = true;
        textElement.innerHTML = text;

        move();
      },
      hide: () => {
        style.opacity = "0";
        visible = false;
      },
      destroy: () => {
        view.container.removeChild(tooltip);
      },
    };
  }

  private enableTooltip(
    view: __esri.MapView,
    layerView: __esri.GraphicsLayerView,
    displayFieldName: string
  ): any {
    let highlight;
    let handles = new Handles();

    const tooltip = this.createTooltip(view);
    const hitTest = promiseUtils.debounce(({ x, y }) => {
      return view
        .hitTest({ x, y }, { include: layerView.layer })
        .then((result: any) => {
          if (!result.results.length) {
            return null;
          }
          return {
            graphic: result.results[0].graphic,
            screenPoint: result.screenPoint,
          };
        });
    });

    handles.add(
      view.on("pointer-move", ({ x, y }) => {
        return hitTest({ x, y }).then(
          (result) => {
            if (highlight) {
              highlight.remove();
              highlight = null;
            }
            if (result) {
              const { graphic, screenPoint } = result;
              highlight = layerView.highlight(graphic);
              tooltip.show(screenPoint, graphic.getAttribute(displayFieldName));
              // view.container.style.cursor = "pointer";
            } else {
              tooltip.hide();
              // view.container.style.cursor = "default";
            }
          },
          (error) => {}
        );
      })
    );

    handles.add(
      view.on("pointer-leave", () => {
        setTimeout(() => {
          if (highlight) {
            highlight.remove();
            highlight = null;
          }
          tooltip.hide();
          // view.container.style.cursor = "default";
        }, 100);
      })
    );

    tooltip.handles = handles;

    return tooltip;
  }

  private disableTooltip(): void {
    if (this.tooltip) {
      this.tooltip.handles.removeAll();
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
