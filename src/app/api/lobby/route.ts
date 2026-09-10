import { handleLobbyRequest } from "@/server/lobby/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleLobbyRequest;
export const POST = handleLobbyRequest;
