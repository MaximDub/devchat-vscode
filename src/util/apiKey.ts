// src/apiKey.ts

import { UiUtilWrapper } from './uiUtil';

export class ApiKeyManager {
	static toProviderKey(provider: string) : string | undefined {
		let providerNameMap = {
			"openai": "OpenAI",
			"cohere": "Cohere",
			"anthropic": "Anthropic",
			"replicate": "Replicate",
			"huggingface": "HuggingFace",
			"together_ai": "TogetherAI",
			"openrouter": "OpenRouter",
			"vertex_ai": "VertexAI",
			"ai21": "AI21",
			"baseten": "Baseten",
			"azure": "Azure",
			"sagemaker": "SageMaker",
			"bedrock": "Bedrock"
		};
		return providerNameMap[provider];
	}
	static async getApiKey(llmType: string = "OpenAI"): Promise<string | undefined> {
		const llmModelT = await this.llmModel();
		if (!llmModelT) {
			return undefined;
		}

		return llmModelT.api_key;
	}

	static async llmModel() {
		const llmModelT = UiUtilWrapper.getConfiguration('devchat', 'defaultModel');
		if (!llmModelT) {
			return undefined;
		}

		const modelProperties = async (modelPropertyName: string, modelName: string) => {
			const modelConfig = UiUtilWrapper.getConfiguration("devchat", modelPropertyName);
			if (!modelConfig) {
			return undefined;
			}

			let modelProperties: any = {};
			for (const key of Object.keys(modelConfig || {})) {
				const property = modelConfig![key];
				modelProperties[key] = property;
			}
			if (!modelConfig["provider"]) {
				return undefined;
			}
			if (!modelConfig["api_key"]) {
				const providerName = this.toProviderKey(modelConfig["provider"]);
				if (!providerName) {
					return undefined;
				}
				const apiKey = await this.loadApiKeySecret(providerName);
				if (!apiKey) {
					return undefined;
				}
				modelProperties["api_key"] = apiKey;
			}

			if (!modelConfig["api_base"] && modelProperties["api_key"]?.startsWith("DC.")) {
				modelProperties["api_base"] = "https://api.devchat.ai/v1";
			}

			modelProperties['model'] = modelName;
			return modelProperties;
		};

		if (llmModelT === "gpt-3.5-turbo") {
			return await modelProperties('Model.gpt-3-5', "gpt-3.5-turbo");
		}
		if (llmModelT === "gpt-3.5-turbo-16k") {
			return await modelProperties('Model.gpt-3-5-16k', "gpt-3.5-turbo-16k");
		}
		if (llmModelT === "gpt-4") {
			return await modelProperties('Model.gpt-4', "gpt-4");
		}
		if (llmModelT === "claude-2") {
			return await modelProperties('Model.claude-2', "claude-2");
		}

		const customModelConfig: any = UiUtilWrapper.getConfiguration('devchat', 'customModel');
		if (!customModelConfig) {
			return undefined;
		}

		const customModels = customModelConfig as Array<any>;
		for (const model of customModels) {
			if (!model.model) {
				continue;
			}
			if (model.model === llmModelT) {
				let modelProperties: any = {};
				for (const key of Object.keys(model || {})) {
					const property = model![key];
					modelProperties[key] = property;
				}

				const modelProvider = model["model"].split('/')[0];
				const modelName = model["model"].split('/').slice(1).join('/');

				if (!model["api_key"]) {
					const providerName = this.toProviderKey(modelProvider);
					if (!providerName) {
						return undefined;
					}
					const apiKey = await this.loadApiKeySecret(providerName);
					if (!apiKey) {
						return undefined;
					}
					modelProperties["api_key"] = apiKey;
				}

				if (!model["api_base"] && modelProperties["api_key"]?.startsWith("DC.")) {
					modelProperties["api_base"] = "https://api.devchat.ai/v1";
				}

				modelProperties["provider"] = modelProvider;
				modelProperties["model"] = modelName;

				return modelProperties;
			}
		}

		return undefined;
	}

	static getKeyType(apiKey: string): string | undefined {
		if (apiKey.startsWith("sk-")) {
			return "sk";
		} else if (apiKey.startsWith("DC.")) {
			return "DC";
		} else {
			return undefined;
		}
	}

	static async writeApiKeySecret(apiKey: string, llmType: string = "Unknow"): Promise<void> {
		await UiUtilWrapper.storeSecret(`Access_KEY_${llmType}`, apiKey);
	}
	static async loadApiKeySecret(llmType: string = "Unknow"): Promise<string | undefined> {
		return await UiUtilWrapper.secretStorageGet(`Access_KEY_${llmType}`);
	}
}