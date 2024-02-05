import { VercelRequest, VercelResponse } from '@vercel/node';
import { gql, GraphQLClient } from 'graphql-request';

import { formatUnits } from 'ethers';

const loadEnv = (env: string) => {
  const v = process.env[env];
  if (!v) {
    throw new Error(`${env} not set`);
  }
  return v;
};

const tallyEndpoint = loadEnv('TALLY_URL');
const tallyApiKey = loadEnv('TALLY_API_KEY');
const tallyAuthKey = 'Api-key';

interface responseFormat {
  governanceBySlug: {
    delegates: {
      account: {
        name: string;
        address: string;
        ens: string;
      };
      stats: {
        votingPower: {
          net: string;
        };
        recentParticipationRate: {
          recentVoteCount: number;
          recentProposalCount: number;
        };
      };
    }[];
  };
}

const graphQLClient = new GraphQLClient(tallyEndpoint, {
  headers: {
    [tallyAuthKey]: tallyApiKey,
  },
});

const query = gql`
  query {
    governanceBySlug(slug: "uniswap") {
      delegates(pagination: { limit: 30 }) {
        account {
          address
          name
          ens
        }
        stats {
          votingPower {
            net
          }
          recentParticipationRate {
            recentVoteCount
            recentProposalCount
          }
        }
      }
    }
  }
`;

export default async (request: VercelRequest, response: VercelResponse) => {
  const data = await graphQLClient.request<responseFormat>(query);

  const delegateData: {
    name: string;
    address: string;
    votes: number;
    votesInLastTenProps: number;
  }[] = data.governanceBySlug.delegates.map(item => {
    const delegate = {
      name: item.account.name,
      address: item.account.address,
      votes: Number(formatUnits(item.stats.votingPower.net, 18)),
      votesInLastTenProps: item.stats.recentParticipationRate.recentVoteCount,
    };

    return delegate;
  });

  const delegatesWithNoVotes = delegateData.reduce((prev, curr) => {
    return curr.votesInLastTenProps > 0 ? prev + 1 : prev;
  }, 0);

  const totalVotes = delegateData.reduce((prev, curr) => {
    return prev + curr.votes;
  }, 0);

  const averageParticipation =
    delegateData.reduce((prev, curr) => {
      return prev + curr.votesInLastTenProps;
    }, 0) / delegateData.length;

  response.send({
    delegateData,
    totalVotes,
    averageParticipation,
    delegatesWithNoVotes,
  });
};
