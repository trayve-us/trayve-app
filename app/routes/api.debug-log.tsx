import { type ActionFunctionArgs, json } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  console.log('🐛 [DEBUG]', body.message, ':', JSON.stringify(body.data, null, 2));
  return json({ success: true });
}
