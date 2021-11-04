// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ResourcePlugins } from "../../../src/plugins/solution/fx-solution/ResourcePluginContainer";
import Container from "typedi";
import {
  AzureAccountProvider,
  ConfigMap,
  Err,
  FxError,
  ok,
  Platform,
  PluginContext,
  Plugin,
  SolutionContext,
  SubscriptionInfo,
  EnvNamePlaceholder,
} from "@microsoft/teamsfx-api";
import * as sinon from "sinon";
import fs, { PathLike } from "fs-extra";
import * as uuid from "uuid";
import {
  HostTypeOptionAzure,
  HostTypeOptionSPFx,
  TabOptionItem,
} from "../../../src/plugins/solution/fx-solution/question";
import {
  deployArmTemplates,
  formattedDeploymentError,
  generateArmTemplate,
  pollDeploymentStatus,
} from "../../../src/plugins/solution/fx-solution/arm";
import * as bicepChecker from "../../../src/plugins/solution/fx-solution/utils/depsChecker/bicepChecker";
import { it } from "mocha";
import path from "path";
import { ArmResourcePlugin } from "../../../src/common/armInterface";
import mockedEnv from "mocked-env";
import { UserTokenCredentials } from "@azure/ms-rest-nodeauth";
import { ResourceManagementModels, Deployments } from "@azure/arm-resources";
import { WebResourceLike, HttpHeaders } from "@azure/ms-rest-js";
import {
  mockedAadScaffoldArmResultV2,
  mockedFehostScaffoldArmResultV2,
  mockedSimpleAuthScaffoldArmResultV2,
} from "./util";
import * as tools from "../../../src/common/tools";
import * as cpUtils from "../../../src/common/cpUtils";
import * as os from "os";

import "../../../src/plugins/resource/frontend";
import "../../../src/plugins/resource/simpleauth";
import "../../../src/plugins/resource/spfx";
import "../../../src/plugins/resource/aad";
import { environmentManager } from "../../../src/core/environment";
import { LocalCrypto } from "../../../src/core/crypto";
import { ConfigKeysOfOtherPlugin } from "../../../src/plugins/resource/aad/constants";

let mockedEnvRestore: () => void;

chai.use(chaiAsPromised);
const expect = chai.expect;

const fehostPlugin = Container.get<Plugin>(ResourcePlugins.FrontendPlugin) as Plugin &
  ArmResourcePlugin;
const simpleAuthPlugin = Container.get<Plugin>(ResourcePlugins.SimpleAuthPlugin) as Plugin &
  ArmResourcePlugin;
const spfxPlugin = Container.get<Plugin>(ResourcePlugins.SpfxPlugin) as Plugin & ArmResourcePlugin;
const aadPlugin = Container.get<Plugin>(ResourcePlugins.AadPlugin) as Plugin & ArmResourcePlugin;

const baseFolder = "./templates/azure";
const templatesFolder = "./templates";
const parameterFolderName = "parameters";
const templateFolderName = "modules";
const configFolderName = "./.fx/configs";
const parameterFileNameTemplate = `azure.parameters.${EnvNamePlaceholder}.json`;
const fileEncoding = "UTF8";
const templateFolder = path.join(baseFolder, templateFolderName);

const TEST_SUBSCRIPTION_ID = "test_subscription_id";
const TEST_RESOURCE_GROUP_NAME = "test_resource_group_name";
const FRONTEND_HOSTING_PLUGIN_ID = "fx-resource-frontend-hosting";

function mockSolutionContext(): SolutionContext {
  return {
    root: "./",
    envInfo: {
      envName: "default",
      state: new Map<string, any>(),
      config: environmentManager.newEnvConfigData("myApp"),
    },
    answers: { platform: Platform.VSCode },
    projectSettings: undefined,
    azureAccountProvider: Object as any & AzureAccountProvider,
    cryptoProvider: new LocalCrypto(""),
  };
}

describe("Generate ARM Template for project", () => {
  const mocker = sinon.createSandbox();
  const testAppName = "my test app";
  const testFolder = "./tests/plugins/solution/testproject";
  let parameterFileName: string;
  beforeEach(async () => {
    mockedEnvRestore = mockedEnv({
      TEAMSFX_INSIDER_PREVIEW: "true",
    });
    parameterFileName = parameterFileNameTemplate.replace(EnvNamePlaceholder, "default");
    await fs.ensureDir(testFolder);
  });

  afterEach(async () => {
    await fs.remove(testFolder);
    mockedEnvRestore();
    mocker.restore();
  });

  it("should do nothing when no plugin implements required interface", async () => {
    const mockedCtx = mockSolutionContext();
    mockedCtx.root = testFolder;
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionSPFx.id,
        name: "spfx",
        version: "1.0",
        activeResourcePlugins: [spfxPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };

    const result = await generateArmTemplate(mockedCtx);
    expect(result.isOk()).to.be.true;
    expect(await fs.pathExists(path.join(testFolder, baseFolder))).to.be.false;
  });

  it("should output templates when plugin implements required interface", async () => {
    const mockedCtx = mockSolutionContext();
    mockedCtx.root = testFolder;
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, simpleAuthPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };
    mocker.stub(environmentManager, "listEnvConfigs").resolves(ok(["default"]));

    // mock plugin behavior
    mocker.stub(fehostPlugin, "generateArmTemplates").callsFake(async (ctx: PluginContext) => {
      return ok(mockedFehostScaffoldArmResultV2);
    });

    mocker.stub(simpleAuthPlugin, "generateArmTemplates").callsFake(async (ctx: PluginContext) => {
      return ok(mockedSimpleAuthScaffoldArmResultV2);
    });

    mocker.stub(aadPlugin, "generateArmTemplates").callsFake(async (ctx: PluginContext) => {
      return ok(mockedAadScaffoldArmResultV2);
    });

    mocker.stub(tools, "getUuid").returns("00000000-0000-0000-0000-000000000000");

    const projectArmTemplateFolder = path.join(testFolder, templateFolder);
    const projectArmParameterFolder = path.join(testFolder, configFolderName);
    const projectArmBaseFolder = path.join(testFolder, baseFolder);
    const result = await generateArmTemplate(mockedCtx);
    expect(result.isOk()).to.be.true;
    expect(
      await fs.readFile(path.join(projectArmTemplateFolder, "../main.bicep"), fileEncoding)
    ).equals(
      `@secure()
param provisionParameters object

module provision './provision.bicep' = {
  name: 'provisionResources'
  params: {
    provisionParameters: provisionParameters
  }
}

module teamsFxConfig './config.bicep' = {
  name: 'addTeamsFxConfigurations'
  params: {
    provisionParameters: provisionParameters
    provisionOutputs: provision
  }
}

output provisionOutput object = provision
output teamsFxConfigurationOutput object = contains(reference(resourceId('Microsoft.Resources/deployments', teamsFxConfig.name), '2020-06-01'), 'outputs') ? teamsFxConfig : {}
`
    );
    expect(
      await fs.readFile(
        path.join(projectArmTemplateFolder, "../provision/frontendHostingProvision.bicep"),
        fileEncoding
      )
    ).equals("Mocked frontend hosting provision module content");
    expect(
      await fs.readFile(
        path.join(projectArmTemplateFolder, "../provision/simpleAuthProvision.bicep"),
        fileEncoding
      )
    ).equals("Mocked simple auth provision module content");
    expect(
      await fs.readFile(path.join(projectArmParameterFolder, parameterFileName), fileEncoding)
    ).equals(
      `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "provisionParameters": {
      "value": {
        "resourceBaseName": "mytestappdefa000000",
        "FrontendParameter": "FrontendParameterValue",
        "SimpleAuthParameter": "SimpleAuthParameterValue"
      }
    }
  }
}`
    );
    expect(await fs.readFile(path.join(projectArmBaseFolder, ".gitignore"), fileEncoding)).equals(
      `# ignore ARM template backup folder${os.EOL}/backup`
    );
  });

  it("should create backup folder when ARM template already exists", async () => {
    const mockedCtx = mockSolutionContext();
    mockedCtx.root = testFolder;
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, simpleAuthPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };

    const projectArmBaseFolder = path.join(mockedCtx.root, baseFolder);
    const projectArmTemplateFolder = path.join(mockedCtx.root, templateFolder);
    const projectConfigFolder = path.join(mockedCtx.root, configFolderName);
    const mockedParameterDefaultJsonContent = "mocked parameter.default.json file";
    const mockedMainBicepContent = "mocked main.bicep file";
    await fs.ensureDir(projectArmBaseFolder);
    await fs.ensureDir(projectArmTemplateFolder);
    await fs.ensureDir(projectConfigFolder);
    await fs.writeFile(
      path.join(projectConfigFolder, parameterFileName),
      mockedParameterDefaultJsonContent
    );
    await fs.writeFile(path.join(projectArmBaseFolder, "main.bicep"), mockedMainBicepContent);

    const result = await generateArmTemplate(mockedCtx);

    expect(result.isOk()).to.be.true;
    const backupBaseFolder = path.join(mockedCtx.root, templatesFolder, "backup");
    expect(await fs.pathExists(backupBaseFolder)).to.be.true;
    const backupFolderItems = await fs.readdir(backupBaseFolder);
    expect(backupFolderItems.length).equals(1);
    const parameterBackupFolder = path.join(
      backupBaseFolder,
      backupFolderItems[0],
      parameterFolderName
    );
    const parameterBackupFiles = await fs.readdir(parameterBackupFolder);
    expect(parameterBackupFiles.length).equals(1);
    expect(
      await fs.readFile(path.join(parameterBackupFolder, parameterBackupFiles[0]), fileEncoding)
    ).equals(mockedParameterDefaultJsonContent);
    const templateBackupFolder = path.join(backupBaseFolder, backupFolderItems[0], templatesFolder);
    const templateBackupFiles = await fs.readdir(templateBackupFolder);
    expect(templateBackupFiles.length).equals(2);
    expect(
      await fs.readFile(path.join(templateBackupFolder, templateBackupFiles[0]), fileEncoding)
    ).equals(mockedMainBicepContent);
  });
});

describe("Deploy ARM Template to Azure", () => {
  const mocker = sinon.createSandbox();
  const testAppName = "my test app";
  let envRestore: () => void;
  const testClientId = "test_client_id";
  const testClientSecret = "test_client_secret";
  const testEnvValue = "test env value";
  const testResourceSuffix = "-testSuffix";
  const testStorageName = "test_storage_name";
  let parameterFileName: string;
  const testArmTemplateOutput = {
    frontendHostingOutput: {
      type: "Object",
      value: {
        teamsFxPluginId: FRONTEND_HOSTING_PLUGIN_ID,
        storageResourceId: `/subscriptions/${TEST_SUBSCRIPTION_ID}/resourceGroups/${TEST_RESOURCE_GROUP_NAME}/providers/Microsoft.Storage/storageAccounts/${testStorageName}`,
        endpoint: `https://${testStorageName}.z13.web.core.windows.net`,
        domain: `${testStorageName}.z13.web.core.windows.net`,
      },
    },
    simpleAuth_skuName: {
      type: "String",
      value: "B1",
    },
    simpleAuth_endpoint: {
      type: "String",
      value: "https://test_simpleauth_domain",
    },
  };
  const SOLUTION_CONFIG = "solution";
  let fileContent: Map<string, any>;
  const mockedArmTemplateJson = `{"test_key": "test_value"}`;

  beforeEach(() => {
    mockedEnvRestore = mockedEnv({
      TEAMSFX_INSIDER_PREVIEW: "true",
    });
    parameterFileName = parameterFileNameTemplate.replace(EnvNamePlaceholder, "default");
    (
      mocker.stub(fs, "readFile") as unknown as sinon.SinonStub<
        [file: number | fs.PathLike],
        Promise<string>
      >
    ).callsFake((file: number | PathLike): Promise<string> => {
      return fileContent.get(file.toString());
    });
    mocker.stub(fs, "stat").callsFake((filePath: PathLike): Promise<fs.Stats> => {
      if (fileContent.has(filePath.toString())) {
        return new Promise<fs.Stats>((resolve) => {
          resolve({} as fs.Stats);
        });
      }
      throw new Error(`${filePath} does not exist.`);
    });
    mocker.stub(fs, "writeFile").callsFake((path: number | PathLike, data: any) => {
      fileContent.set(path.toString(), data);
    });
    mocker.stub(bicepChecker, "ensureBicep").callsFake(async (ctx: SolutionContext) => "bicep");
    mocker.stub(tools, "waitSeconds").resolves();

    fileContent = new Map([
      [
        path.join(configFolderName, parameterFileName),
        `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "resourceBaseName": {
      "value": "mytestappdefault"
    },
    "aadClientId": {
      "value": "{{state.fx-resource-aad-app-for-teams.clientId}}"
    },
    "aadClientSecret": {
      "value": "{{state.fx-resource-aad-app-for-teams.clientSecret}}"
    },
    "envValue": {
      "value": "{{MOCKED_EXPAND_VAR_TEST}}"
    }
  }
  }
  `,
      ],
    ]);
  });

  afterEach(() => {
    envRestore();
    mockedEnvRestore();
    mocker.restore();
  });

  it("should fail when main.bicep do not exist", async () => {
    // Arrange
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, simpleAuthPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };
    mockedCtx.envInfo.state.set(
      "fx-resource-aad-app-for-teams",
      new ConfigMap([["clientId", testClientId]])
    );
    mockedCtx.envInfo.state.set(
      SOLUTION_CONFIG,
      new ConfigMap([
        ["resource-base-name", "mocked resource base name"],
        ["resourceGroupName", TEST_RESOURCE_GROUP_NAME],
      ])
    );

    envRestore = mockedEnv({
      MOCKED_EXPAND_VAR_TEST: "mocked environment variable",
    });

    // Act
    const result = await deployArmTemplates(mockedCtx);

    // Assert
    chai.assert.isTrue(result.isErr());
    const error = (result as Err<void, FxError>).error;
    chai.expect(error.name).to.equal("FailedToDeployArmTemplatesToAzure");
    chai
      .expect(error.message)
      .to.have.string("Failed to compile bicep files to Json arm templates file:");
  });

  it("should successfully update parameter and deploy arm templates to azure", async () => {
    // Arrange
    const mockedCtx = mockSolutionContext();
    let parameterAfterDeploy = "";
    let armTemplateJson = "";
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, simpleAuthPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };
    mockArmDeploymentDependencies(mockedCtx);

    mockedCtx.envInfo.state.set(
      "fx-resource-aad-app-for-teams",
      new ConfigMap([
        ["clientId", testClientId],
        ["clientSecret", testClientSecret],
      ])
    );
    envRestore = mockedEnv({
      MOCKED_EXPAND_VAR_TEST: testEnvValue,
    });

    mocker
      .stub(Deployments.prototype, "createOrUpdate")
      .callsFake(
        (
          resourceGroupName: string,
          deploymentName: string,
          parameters: ResourceManagementModels.Deployment
        ) => {
          armTemplateJson = parameters.properties.template;
          parameterAfterDeploy = parameters.properties.parameters;
          chai.assert.exists(parameters.properties.parameters?.aadClientSecret);
          chai.assert.notStrictEqual(
            parameters.properties.parameters?.aadClientSecret,
            "{{state.fx-resource-aad-app-for-teams.clientSecret}}"
          );

          return new Promise((resolve) => {
            resolve({
              properties: {
                outputs: testArmTemplateOutput,
              },
              _response: {
                request: {} as WebResourceLike,
                status: 200,
                headers: new HttpHeaders(),
                bodyAsText: "",
                parsedBody: {} as ResourceManagementModels.DeploymentExtended,
              },
            });
          });
        }
      );

    // Act
    const result = await deployArmTemplates(mockedCtx);

    // Assert
    chai.assert.isTrue(result.isOk());
    expect(armTemplateJson).to.deep.equals(JSON.parse(mockedArmTemplateJson));
    chai.assert.isNotNull(parameterAfterDeploy);
    expect(parameterAfterDeploy).to.deep.equals(
      JSON.parse(`{
        "resourceBaseName": {
          "value": "mytestappdefault"
        },
        "aadClientId": {
          "value": "${testClientId}"
        },
        "aadClientSecret": {
          "value": "${testClientSecret}"
        },
        "envValue": {
          "value": "${testEnvValue}"
        }
      }`)
    );
    chai.assert.strictEqual(
      mockedCtx.envInfo.state.get(SOLUTION_CONFIG)?.get("armTemplateOutput"),
      testArmTemplateOutput
    );
  });

  it("should use existing parameter file", async () => {
    const mockedCtx = mockSolutionContext();
    mockedCtx.projectSettings = {
      appName: testAppName,
      projectId: uuid.v4(),
      solutionSettings: {
        hostType: HostTypeOptionAzure.id,
        name: "azure",
        version: "1.0",
        activeResourcePlugins: [fehostPlugin.name, simpleAuthPlugin.name],
        capabilities: [TabOptionItem.id],
      },
    };

    mockArmDeploymentDependencies(mockedCtx);

    fileContent.set(
      path.join(configFolderName, parameterFileName),
      `{
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      "contentVersion": "1.0.0.0",
      "parameters": {
          "existingFileTest": {
              "value": "mocked value"
          }
      }
  }`
    );

    let usedExistingParameterDefaultFile = false;
    mocker
      .stub(Deployments.prototype, "createOrUpdate")
      .callsFake(
        (
          resourceGroupName: string,
          deploymentName: string,
          parameters: ResourceManagementModels.Deployment
        ) => {
          if (parameters.properties.parameters?.existingFileTest) {
            usedExistingParameterDefaultFile = true;
          } //content of parameter.default.json should be used

          return new Promise((resolve) => {
            resolve({
              properties: {
                outputs: testArmTemplateOutput,
              },
              _response: {
                request: {} as WebResourceLike,
                status: 200,
                headers: new HttpHeaders(),
                bodyAsText: "",
                parsedBody: {} as ResourceManagementModels.DeploymentExtended,
              },
            });
          });
        }
      );

    // Act
    const result = await deployArmTemplates(mockedCtx);
    chai.assert.isTrue(result.isOk());
    chai.assert.strictEqual(usedExistingParameterDefaultFile, true);
  });

  function mockArmDeploymentDependencies(mockedCtx: SolutionContext) {
    mockedCtx.envInfo.state.set(
      SOLUTION_CONFIG,
      new ConfigMap([
        ["resourceGroupName", TEST_RESOURCE_GROUP_NAME],
        ["resourceNameSuffix", testResourceSuffix],
        ["subscriptionId", TEST_SUBSCRIPTION_ID],
      ])
    );

    mockedCtx.azureAccountProvider!.getAccountCredentialAsync = async function () {
      const azureToken = new UserTokenCredentials(
        testClientId,
        "test_domain",
        "test_username",
        "test_password"
      );
      return azureToken;
    };

    mockedCtx.azureAccountProvider!.getSelectedSubscription = async function () {
      const subscriptionInfo = {
        subscriptionId: TEST_SUBSCRIPTION_ID,
        subscriptionName: "test_subsctiption_name",
      } as SubscriptionInfo;
      return subscriptionInfo;
    };

    mocker.stub(cpUtils, "executeCommand").returns(
      new Promise((resolve) => {
        resolve(mockedArmTemplateJson);
      })
    );
  }
});

describe("Arm Template Failed Test", () => {
  const mocker = sinon.createSandbox();
  beforeEach(async () => {
    mocker.stub(tools, "waitSeconds").resolves();
  });

  afterEach(async () => {
    mocker.restore();
  });

  it("should get pollDeploymentStatus error", async () => {
    const mockedCtx = mockSolutionContext();
    const mockedDeployCtx: any = getMockedDeployCtx(mockedCtx);
    mockedDeployCtx.client = {
      deploymentOperations: {
        list: async () => {
          throw new Error("mocked error");
        },
      },
    };
    let isErrorThrown = false;
    try {
      await pollDeploymentStatus(mockedDeployCtx);
    } catch (error) {
      chai.assert.strictEqual(error.message, "mocked error");
      isErrorThrown = true;
    }
    chai.assert.isTrue(isErrorThrown);
  });

  it("pollDeploymentStatus OK", async () => {
    const mockedCtx = mockSolutionContext();
    const operations = [
      {
        properties: {
          targetResource: {
            resourceName: "test resource",
          },
          provisioningState: "Running",
          timestamp: Date.now(),
        },
      },
    ];
    const mockedDeployCtx: any = getMockedDeployCtx(mockedCtx);
    let count = 0;
    mockedDeployCtx.client = {
      deploymentOperations: {
        list: async () => {
          if (count > 1) {
            mockedDeployCtx.finished = true;
          }
          count++;
          return operations;
        },
      },
    };

    const res = await pollDeploymentStatus(mockedDeployCtx);
    chai.assert.isUndefined(res);
  });

  it("formattedDeploymentError OK", async () => {
    const errors = {
      error: {
        code: "OutsideError",
        message: "out side error",
      },
      subErrors: {
        botProvision: {
          error: {
            code: "BotError",
            message: "bot error",
          },
          inner: {
            error: {
              code: "BotInnerError",
              message: "bot inner error",
            },
            subErrors: {
              usefulError: {
                error: {
                  code: "usefulError",
                  message: "useful error",
                },
              },
              uselessError: {
                error: {
                  code: "DeploymentOperationFailed",
                  message:
                    "Template output evaluation skipped: at least one resource deployment operation failed. Please list deployment operations for details. Please see https://aka.ms/DeployOperations for usage details.",
                },
              },
            },
          },
        },
      },
    };
    const res = formattedDeploymentError(errors);
    chai.assert.deepEqual(res, {
      botProvision: {
        usefulError: {
          code: "usefulError",
          message: "useful error",
        },
      },
    });
  });

  function getMockedDeployCtx(mockedCtx: any) {
    return {
      resourceGroupName: "poll-deployment-rg",
      deploymentName: "poll-deployment",
      finished: false,
      deploymentStartTime: Date.now(),
      ctx: mockedCtx,
    };
  }
});
