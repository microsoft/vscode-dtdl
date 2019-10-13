// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as request from "request-promise";
import { Constants } from "../common/constants";
import { ModelType } from "../deviceModel/deviceModelManager";
import { GetResult, MetaModelType, SearchOptions, SearchResult } from "./modelRepositoryInterface";
import { RepositoryInfo } from "./modelRepositoryManager";

const ETAG_HEADER = "etag";
const MODEL_ID_HEADER = "x-ms-model-id";
const MODEL_PATH = "models";
const SEARCH_PATH = "models/search";
const CONTENT_TYPE = "application/json";

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

export class ModelRepositoryClient {
  public static async getModel(repoInfo: RepositoryInfo, modelId: string, expand: boolean = false): Promise<GetResult> {
    const options: request.OptionsWithUri = ModelRepositoryClient.buildOptions(HttpMethod.Get, repoInfo, modelId);
    if (expand) {
      options.qs.expand = "true";
    }

    return new Promise<GetResult>((resolve, reject) => {
      request(options)
        .then((response) => {
          const result: GetResult = {
            etag: response.headers[ETAG_HEADER],
            modelId: response.headers[MODEL_ID_HEADER],
            content: response.body,
          };
          return resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static async searchModel(
    repoInfo: RepositoryInfo,
    type: ModelType,
    keyword: string,
    pageSize: number,
    continuationToken: string | null,
  ): Promise<SearchResult> {
    const options: request.OptionsWithUri = ModelRepositoryClient.buildOptions(HttpMethod.Post, repoInfo);
    const modelFilterType: MetaModelType = ModelRepositoryClient.convertToMetaModelType(type);
    const payload: SearchOptions = {
      searchKeyword: keyword,
      modelFilterType,
      continuationToken,
      pageSize,
    };
    options.body = payload;

    return new Promise<SearchResult>((resolve, reject) => {
      request(options)
        .then((response) => {
          const result = response.body as SearchResult;
          return resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static async updateModel(repoInfo: RepositoryInfo, modelId: string, content: any): Promise<string> {
    const options: request.OptionsWithUri = ModelRepositoryClient.buildOptions(HttpMethod.Put, repoInfo, modelId);
    options.body = content;

    return new Promise<string>((resolve, reject) => {
      request(options)
        .then((response) => {
          const result: string = response.headers[ETAG_HEADER];
          return resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static async deleteModel(repoInfo: RepositoryInfo, modelId: string): Promise<void> {
    const options: request.OptionsWithUri = ModelRepositoryClient.buildOptions(HttpMethod.Delete, repoInfo, modelId);

    return new Promise<void>((resolve, reject) => {
      request(options)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  private static convertToMetaModelType(type: ModelType): MetaModelType {
    switch (type) {
      case ModelType.Interface:
        return MetaModelType.Interface;
      case ModelType.CapabilityModel:
        return MetaModelType.CapabilityModel;
      default:
        return MetaModelType.None;
    }
  }

  private static buildOptions(method: HttpMethod, repoInfo: RepositoryInfo, modelId?: string): request.OptionsWithUri {
    const uri = modelId
      ? `${repoInfo.hostname}/${MODEL_PATH}/${encodeURIComponent(modelId)}`
      : `${repoInfo.hostname}/${SEARCH_PATH}`;
    const qs: any = { "api-version": repoInfo.apiVersion };
    if (repoInfo.repositoryId) {
      qs.repositoryId = repoInfo.repositoryId;
    }
    const accessToken = repoInfo.accessToken || Constants.EMPTY_STRING;
    const options: request.OptionsWithUri = {
      method,
      uri,
      qs,
      encoding: Constants.UTF8,
      json: true,
      headers: { "Authorization": accessToken, "Content-Type": CONTENT_TYPE },
      resolveWithFullResponse: true,
    };
    return options;
  }

  private constructor() {}
}
