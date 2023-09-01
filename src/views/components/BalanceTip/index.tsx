import React, { useEffect, useState } from "react";
import axios from "axios";
import messageUtil from "@/util/MessageUtil";
import { IconWallet } from "@tabler/icons-react";
import { HoverCard, Text, ActionIcon, Group } from "@mantine/core";

const currencyMap = {
  USD: "$",
  RMB: "¥",
};

function formatBalance(balance: number) {
  return Math.round(balance * 1000) / 1000;
}

function formatCurrency(balance: number, currency: string) {
  return `${currencyMap[currency] || currency}${balance}`;
}

const envMap = {
  dev: {
    requestUrl: "https://apptest.devchat.ai",
    link: "https://test.devchat.ai",
  },
  prod: {
    requestUrl: "https://app.devchat.ai",
    link: "https://devchat.ai",
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export default function WechatTip() {
  const [bindWechat, setBindWechat] = useState(false);
  const [balance, setBalance] = useState<null | number>(null);
  const [currency, setCurrency] = useState("USD");
  const [accessKey, setAccessKey] = useState("");
  const [env, setEnv] = useState("prod");
  const [loading, setLoading] = useState(false);

  const getSettings = () => {
    messageUtil.sendMessage({
      command: "getUserAccessKey",
    });
  };

  const getBalance = () => {
    if (!envMap[env].requestUrl || !accessKey) {
      return;
    }
    setLoading(true);
    axios
      .get(`${envMap[env].requestUrl}/api/v1/users/profile`, {
        headers: { Authorization: `Bearer ${accessKey}` },
      })
      .then((res) => {
        if (res?.data?.user?.wechat_nickname) {
          setBindWechat(true);
        }
        if (res?.data?.organization?.balance) {
          setBalance(formatBalance(res?.data?.organization?.balance));
          setCurrency(res?.data?.organization?.currency);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (env && accessKey) {
      getBalance();
    }
  }, [env, accessKey]);

  useEffect(() => {
    getSettings();
    messageUtil.registerHandler(
      "getUserAccessKey",
      (message: { endPoint: string; accessKey: string; keyType: string }) => {
        if (message.keyType === "DevChat" && message.accessKey) {
          if (message.endPoint.includes("api-test.devchat.ai")) {
            setEnv("dev");
          } else {
            setEnv("prod");
          }
          setAccessKey(message.accessKey);
        }
      }
    );
  }, []);

  if (balance === null || balance === undefined) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 2,
        right: 5,
        top: 5,
      }}
    >
      <HoverCard
        onOpen={getBalance}
        position="left"
        width="200"
        withArrow={true}
      >
        <HoverCard.Target>
          <div onMouseEnter={getBalance}>
            <ActionIcon
              loading={loading}
              color="blue"
              radius="xl"
              variant="filled"
              sx={{
                opacity: 0.5,
                transition: "opacity 300ms ease",
                "&:hover": {
                  opacity: 1,
                },
              }}
            >
              <IconWallet size="16" />
            </ActionIcon>
          </div>
        </HoverCard.Target>
        <HoverCard.Dropdown>
          <Group style={{ width: "90%" }}>
            <Text size="sm">
              Your remaining credit is {formatCurrency(balance, currency)}. Sign
              in to <a href={envMap[env].link}>devchat.ai </a>to{" "}
              {bindWechat ? "purchase more tokens." : "earn additional ¥8"}
            </Text>
          </Group>
        </HoverCard.Dropdown>
      </HoverCard>
    </div>
  );
}
