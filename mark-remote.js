/** Mark Typert Remote methods on a service prototype (plain JS, no TS decorators). */
const REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";

function readRemoteMethodDescriptor(prototype) {
	const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
	if (property === undefined) return undefined;
	const descriptor = property.value;
	if (descriptor === null || typeof descriptor !== "object") {
		throw new TypeError("typert-protocol: Remote method descriptor must be an object");
	}
	if (Reflect.get(descriptor, "version") !== 1) {
		throw new TypeError("typert-protocol: unsupported Remote method descriptor version");
	}
	const methods = Reflect.get(descriptor, "methods");
	if (!Array.isArray(methods)) {
		throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
	}
	return descriptor;
}

export function markRemoteMethod(prototype, method, exportName = method) {
	const invocation = Object.freeze({ kind: "direct" });
	const descriptor = readRemoteMethodDescriptor(prototype);
	const marker = Object.freeze({
		method,
		...(exportName === method ? {} : { exportName }),
		invocation,
	});
	const current = descriptor?.methods.find((candidate) => candidate.method === method);
	if (current !== undefined) {
		if (
			current.exportName === marker.exportName &&
			current.mode === marker.mode &&
			current.invocation.kind === "direct" &&
			invocation.kind === "direct"
		) {
			return;
		}
		throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
	}
	Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
		configurable: true,
		value: Object.freeze({
			version: 1,
			methods: Object.freeze([...(descriptor?.methods ?? []), marker]),
		}),
	});
}
