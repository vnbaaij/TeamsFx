// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  assembleError,
  err,
  FxError,
  LocalFunc,
  ok,
  OnSelectionChangeFunc,
  Result,
  SystemError,
  ValidateFunc,
} from "@microsoft/teamsfx-api";

import { CustomizeFuncType } from "./apis";

export let GlobalFuncId = 0;
export type FuncType = LocalFunc<any> | ValidateFunc<any> | OnSelectionChangeFunc;

export const GlobalFuncMap = new Map<number, FuncType>();

export function setFunc(func: FuncType): number {
  ++GlobalFuncId;
  GlobalFuncMap.set(GlobalFuncId, func);
  return GlobalFuncId;
}

export function getFunc(id: number): FuncType | undefined {
  const func = GlobalFuncMap.get(id);
  return func;
}

export async function callFunc(
  type: CustomizeFuncType,
  id: number,
  ...params: any[]
): Promise<Result<any, FxError>> {
  const func = getFunc(id);
  if (func) {
    let result: any;
    try {
      if (type === "LocalFunc") {
        result = await (func as LocalFunc<any>)(params[0]);
      } else if (type === "ValidateFunc") {
        result = await (func as ValidateFunc<any>)(params[0], params[1]);
      } else if (type === "OnSelectionChangeFunc") {
        result = await (func as OnSelectionChangeFunc)(
          new Set<string>(params[0]),
          new Set<string>(params[1])
        );
      }
      return ok(result);
    } catch (e) {
      return err(assembleError(e));
    }
  }
  return err(new SystemError("FuncNotFound", `Function not found, id: ${id}`, "FxCoreServer"));
}

export function reset(): void {
  GlobalFuncId = 0;
  GlobalFuncMap.clear();
}
