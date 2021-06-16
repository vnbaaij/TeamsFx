// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { HookContext, NextFunction, Middleware } from "@feathersjs/hooks"; 
import { assembleError, err, FxError, Inputs, Result } from "@microsoft/teamsfx-api";
import { kebabCase } from "lodash";
import { CoreHookContext, FxCore } from "..";
import { sendTelemetryEvent, TelemetryProperty, TelemetrySuccess } from "../../common/telemetry";

/**
 * Telemetry sender
 */
export const TelemetrySenderMW: Middleware = async (
  ctx: CoreHookContext,
  next: NextFunction
) => {
  const core = ctx.self as FxCore;
  const inputs = ctx.arguments[ctx.arguments.length - 1] as Inputs;
	const solutionContext = ctx.solutionContext;
	const appId = solutionContext?.config?.get("solution")?.get("remoteTeamsAppId") as string;
	const properties:any = {module:"fx-core"};
	if(appId) 
		properties[TelemetryProperty.AppId] = appId;
	const method = kebabCase(ctx.method!);
  let result:Result<any, FxError>|undefined = undefined;
  try {
		sendTelemetryEvent(core.tools.telemetryReporter, inputs,  method + "-start", properties);
    result = await next();
  } catch (e) {
    result = err(assembleError(e));
    throw e;
  } finally{
    if(result?.isOk()){
			properties[TelemetryProperty.Success] = TelemetrySuccess.Yes;
			sendTelemetryEvent(core.tools.telemetryReporter, inputs, method, properties);
		}
		else {
			properties[TelemetryProperty.Success] = TelemetrySuccess.No;
			sendTelemetryEvent(core.tools.telemetryReporter, inputs, method, properties);
		}
  }
};