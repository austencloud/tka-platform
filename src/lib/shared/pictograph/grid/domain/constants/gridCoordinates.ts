import type { GridMode } from "../enums/grid-enums";
import type { GridCoordinateData } from "../models/grid-models";

export const gridCoordinates: Record<
  Exclude<GridMode, GridMode.SKEWED>,
  GridCoordinateData
> = {
  diamond: {
    hand_points: {
      normal: {
        n_diamond_hand_point: "(475.0, 331.9)",
        e_diamond_hand_point: "(618.1, 475.0)",
        s_diamond_hand_point: "(475.0, 618.1)",
        w_diamond_hand_point: "(331.9, 475.0)",
      },
      strict: {
        n_diamond_hand_point_strict: "(475.0, 325.0)",
        e_diamond_hand_point_strict: "(625.0, 475.0)",
        s_diamond_hand_point_strict: "(475.0, 625.0)",
        w_diamond_hand_point_strict: "(325.0, 475.0)",
      },
    },
    layer2_points: {
      normal: {
        ne_diamond_layer2_point: "(618.1, 331.9)",
        se_diamond_layer2_point: "(618.1, 618.1)",
        sw_diamond_layer2_point: "(331.9, 618.1)",
        nw_diamond_layer2_point: "(331.9, 331.9)",
      },
      strict: {
        ne_diamond_layer2_point_strict: "(625.0, 325.0)",
        se_diamond_layer2_point_strict: "(625.0, 625.0)",
        sw_diamond_layer2_point_strict: "(325.0, 625.0)",
        nw_diamond_layer2_point_strict: "(325.0, 325.0)",
      },
    },
    outer_points: {
      n_diamond_outer_point: "(475, 175)",
      e_diamond_outer_point: "(775, 475)",
      s_diamond_outer_point: "(475, 775)",
      w_diamond_outer_point: "(175, 475)",
    },
    center_point: "(475.0, 475.0)",
  },
  box: {
    hand_points: {
      normal: {
        ne_box_hand_point: "(576.2, 373.8)",
        se_box_hand_point: "(576.2, 576.2)",
        sw_box_hand_point: "(373.8, 576.2)",
        nw_box_hand_point: "(373.8, 373.8)",
      },
      strict: {
        ne_box_hand_point_strict: "(581.1, 368.9)",
        se_box_hand_point_strict: "(581.1, 581.1)",
        sw_box_hand_point_strict: "(368.9, 581.1)",
        nw_box_hand_point_strict: "(368.9, 368.9)",
      },
    },
    layer2_points: {
      normal: {
        n_box_layer2_point: "(475, 272.6)",
        e_box_layer2_point: "(677.4, 475)",
        s_box_layer2_point: "(475, 677.4)",
        w_box_layer2_point: "(272.6, 475)",
      },
      strict: {
        n_box_layer2_point_strict: "(475, 262.9)",
        e_box_layer2_point_strict: "(687.1, 475)",
        s_box_layer2_point_strict: "(475, 687.1)",
        w_box_layer2_point_strict: "(262.9, 475)",
      },
    },
    outer_points: {
      ne_box_outer_point: "(262.9, 247.9)",
      se_box_outer_point: "(687.1, 247.9)",
      sw_box_outer_point: "(687.1, 672.1)",
      nw_box_outer_point: "(262.9, 672.1)",
    },
    center_point: "(475.0, 475.0)",
  },
};
