import { ThemeVariables, css, SerializedStyles } from "jimu-core";

export function getStyle(theme: ThemeVariables): SerializedStyles {
  return css`
    overflow: auto;
    .arcdata-service-area {
      width: 100%;
      height: 100%;
      display: inline-table;
      padding: 5px;
      position: relative;
      color: ${theme.colors.black};

      .esri-slider {
        padding: 0 10px;
        padding-bottom: 25px;
        color: ${theme.colors.black};
      }

      .esri-slider__tick-label {
        font-size: 12px;
      }

      .esri-slider__anchor {
        z-index: 1;
      }

      .esri-slider__thumb {
        border-color: ${theme.colors.primary};
      }

      .esri-slider__anchor:focus .esri-slider__thumb {
        outline: none;
        border-color: ${theme.colors.primary};
      }

      .esri-search__suggestions-menu {
        z-index: 10;
      }

      .esri-menu {
        z-index: 10;
      }

      .esri-search {
        border: none;
      }

      .esri-search__input {
        padding-right: 25px;
      }
    };
    .arcdata-service-area__loader {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(255, 255, 255, 0.5);
      flex-direction: column;
      text-align: center;
      z-index: 10;
    };
  `;
}
