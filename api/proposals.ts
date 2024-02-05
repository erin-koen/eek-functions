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
    proposals: {
      id: string;
      voteStats: {
        support: 'FOR' | 'AGAINST' | 'ABSTAIN';
        weight: string;
      }[];
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
      proposals(sort: { field: START_BLOCK, order: DESC }) {
        id
        voteStats {
          support
          weight
        }
      }
    }
  }
`;

export default async (request: VercelRequest, response: VercelResponse) => {
  const data = await graphQLClient.request<responseFormat>(query);

  const formattedData: { id: number; totalVotes: number }[] =
    data.governanceBySlug.proposals
      .map(item => {
        const totalVotes = item.voteStats.reduce((prev, curr) => {
          const currentVotes = Number(formatUnits(curr.weight, 18));
          return prev + currentVotes;
        }, 0);
        return {
          id: Number(item.id),
          totalVotes,
        };
      })
      .sort((a, b) => a.id - b.id);

  response.send(formattedData);
};
