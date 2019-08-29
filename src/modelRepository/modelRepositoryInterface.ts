// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export enum MetaModelType {
  None = "none",
  Interface = "interface",
  CapabilityModel = "capabilityModel",
}

export interface LocalizedData {
  locale: string;
  value: string;
}

export interface DigitalTwinModelBase {
  contents?: string;
  comment?: string;
  description?: string;
  displayName?: LocalizedData[];
  urnId: string;
  modelName: string;
  version: number;
  type: string;
  etag: string;
  publisherId: string;
  publisherName: string;
  createdOn: string;
  lastUpdated: string;
}

export interface SearchOptions {
  searchKeyword: string;
  modelFilterType: MetaModelType;
  continuationToken: string | null;
  pageSize?: number;
}

export interface SearchResult {
  continuationToken?: string;
  results: DigitalTwinModelBase[];
}

export interface GetResult {
  etag: string;
  modelId: string;
  content: { [key: string]: string };
}
