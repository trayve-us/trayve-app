import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, Button, BlockStack, Text, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../config/shopify.server";
import { getOrCreateShopifyUser } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get or create Shopify user (creates user + 2000 credits if new)
  const { user, isNewUser } = await getOrCreateShopifyUser(shop, {
    shopId: session.id,
  });

  // Get credit balance
  const balance = await getUserCreditBalance(user.trayve_user_id);

  return json({
    shop,
    isNewUser,
    credits: balance
      ? {
          available: balance.available_credits,
          total: balance.total_credits,
        }
      : { available: 0, total: 0 },
  });
};

export default function Index() {
  const { shop, isNewUser, credits } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Auto-redirect to studio after component mounts (client-side)
  useEffect(() => {
    navigate('/app/studio');
  }, [navigate]);

  return (
    <Page>
      <TitleBar title="Trayve Virtual Try-On" />
      <BlockStack gap="500">
        {isNewUser && (
          <Banner
            title="Welcome to Trayve!"
            tone="success"
          >
            <p>You've been credited with 2,000 credits to get started. Start creating amazing product images!</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h1" variant="headingLg">
                    Welcome to Trayve Virtual Try-On
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Create stunning product images with AI-powered virtual try-on technology.
                    Upload your clothing images and generate professional product photos in seconds.       
                  </Text>
                  <Text as="p" variant="bodyMd" tone="success">
                    Available Credits: <strong>{credits.available.toLocaleString()}</strong>
                  </Text>
                </BlockStack>                <Button
                  variant="primary"
                  onClick={() => navigate('/app/studio')}
                  size="large"
                >
                  Open Virtual Try-On Studio
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  ⚡ Fast Generation
                </Text>
                <Text as="p" variant="bodyMd">
                  Get professional images in under 60 seconds.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  ��� High Quality
                </Text>
                <Text as="p" variant="bodyMd">
                  4K resolution images with realistic details.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  ��� Diverse Models
                </Text>
                <Text as="p" variant="bodyMd">
                  Choose from a wide range of model types.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  ��� Flexible Pricing
                </Text>
                <Text as="p" variant="bodyMd">
                  Pay only for what you use with credits.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Your Shop
                </Text>
                <Text as="p" variant="bodyMd">
                  Connected to: <strong>{shop}</strong>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
