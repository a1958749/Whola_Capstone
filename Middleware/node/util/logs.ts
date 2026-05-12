const DATA_ENTITY = 'hubspot_logs';
const SCHEMA = 'hubspot';

export async function createLogsSchema(ctx: any) {
  const {
    clients: { masterdata },
  } = ctx;

  try {
    const schema = await masterdata.getSchema({
      dataEntity: DATA_ENTITY,
      schema: SCHEMA,
    });
    
    if (!schema) {
      await masterdata.createOrUpdateSchema({
        dataEntity: DATA_ENTITY,
        schemaName: SCHEMA,
        schemaBody: {
          properties: {
            orderId: {
              type: 'string',
              title: 'Vtex Order Id',
            },
            message: {
              type: 'string',
              title: 'Message',
            },
            body: {
              type: 'string',
              title: 'Body',
            },
          },
          'v-indexed': ['orderId'],
          'v-security': {
            allowGetAll: false,
            publicRead: ['id', 'orderId', 'message', 'body'],
            publicWrite: ['orderId', 'message', 'body'],
            publicFilter: ['orderId', 'message', 'body'],
          },
        },
      });
    }

    return {
      isError: false,
    };
  } catch (e) {
    console.log(e.message);
    console.log(e.response);
    if (e.response?.status === 304) {
      return { isError: false };
    }
    return {
      isError: true,
    };
  }
}

export async function addLog(
  ctx: any,
  log: {
    orderId: string | null;
    message: string | null;
    body: string | null;
  },
) {
  const {
    clients: { masterdata },
  } = ctx;

  console.log('ADD LOG', log);

  try { 
    await masterdata.createDocument({
        dataEntity: DATA_ENTITY,
        schema: SCHEMA,
        fields: {
          orderId: log.orderId ?? '',
          message: log.message ?? '',
          body: log.body ?? '',
        },
      });
  }
  catch(e) {
    console.log('Error in the addLog function', e.message)
  }
}
