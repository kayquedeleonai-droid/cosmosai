import type { Node, Edge } from '@xyflow/react';
import { catalog } from './graph.mjs';

export type Kind = keyof typeof catalog;
export type NodeData = {
  kind: Kind;
  prompt?: string;
  image?: string;
  result?: string;
  status?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  duration?: string;
  mediaType?: string;
  pendingTask?: string;
  compareMode?: string;
  compareSplit?: string;
  compareOutput?: string;
  [key: string]: unknown;
};
export type FlowNode = Node<NodeData>;
export type Project = {
  version: 1;
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  nodes: FlowNode[];
  edges: Edge[];
};
export const DEMO_IMAGE = '/demo-landscape.svg';
