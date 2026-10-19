import * as listService from "./service.js";

export async function listController(req, res) {
  const payload = await listService.listEntries(req.user.id, req.query);
  res.status(200).json(payload);
}

export async function createController(req, res) {
  const entry = await listService.createEntry(req.user.id, req.body);
  res.status(201).json(entry);
}

export async function updateController(req, res) {
  const entry = await listService.updateEntry(req.user.id, req.params.id, req.body);
  res.status(200).json(entry);
}

export async function deleteController(req, res) {
  await listService.deleteEntry(req.user.id, req.params.id);
  res.status(204).end();
}

export async function statsController(req, res) {
  const stats = await listService.getStats(req.user.id);
  res.status(200).json(stats);
}