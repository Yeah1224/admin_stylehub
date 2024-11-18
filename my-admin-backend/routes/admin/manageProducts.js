const express = require('express');
const router = express.Router();
const db = require('../../db');
const multer = require('multer');
const path = require('path');

// Cấu hình multer để xử lý file tải lên
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Đảm bảo thư mục 'uploads' tồn tại
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Tên file duy nhất
  }
});

const upload = multer({ storage });


// Endpoint hiển thị danh sách sản phẩm kèm brands và cate
router.get('/', (req, res) => {
  const query = `
      SELECT p.*, b.brand_name, c.cate_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN categories c ON p.cate_id = c.cate_id
  `;

  db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
  });
})

// Endpoint thêm sản phẩm mới
router.post('/', upload.single('image'), (req, res) => {
  console.log('Dữ liệu nhận được:', req.body);
  console.log('Thông tin file upload:', req.file);

  const { product_name, cost, quantity, brand_id, size_id, cate_id } = req.body;

  // Kiểm tra và xử lý giá trị imageUrl và size_id
  const imageUrl = req.file ? req.file.filename : null;
  const sizeIdValue = size_id && size_id.trim() !== '' ? size_id : null;

  // SQL query để thêm sản phẩm
  const sql = `
    INSERT INTO products (product_name, cost, quantity, brand_id, size_id, cate_id, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [product_name, cost, quantity, brand_id, sizeIdValue, cate_id, imageUrl];

  console.log('SQL Query:', sql, 'Values:', values);

  // Thực thi query
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Lỗi khi thêm sản phẩm:', err);
      // Xử lý lỗi khóa ngoại hoặc lỗi dữ liệu nhập
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Sai thông tin khóa ngoại. Vui lòng kiểm tra các giá trị brand_id, size_id hoặc cate_id.' });
      }
      return res.status(500).json({ error: 'Lỗi khi thêm sản phẩm. Vui lòng thử lại sau.' });
    }

    // Phản hồi thông tin sản phẩm đã thêm
    res.status(201).json({
      product_id: result.insertId, // ID của sản phẩm mới được tạo
      product_name,
      cost,
      quantity,
      brand_id,
      size_id: sizeIdValue,
      cate_id,
      imageUrl,
    });
  });
});
// Sửa sản phẩm
router.put('/:product_id', upload.single('image'), (req, res) => {
  const { product_id } = req.params;
  const { product_name, cost, quantity, brand_id, size_id, cate_id } = req.body;

  // Đường dẫn ảnh nếu có, nếu không thì giữ nguyên ảnh cũ
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const sql = `
      UPDATE products 
      SET product_name = ?, cost = ?, quantity = ?, brand_id = ?, size_id = ?, cate_id = ?, imageUrl = COALESCE(?, imageUrl)
      WHERE product_id = ?`;

  db.query(sql, [product_name, cost, quantity, brand_id, size_id, cate_id, imageUrl, product_id], (err) => {
      if (err) {
          console.error('Error updating product:', err);
          return res.status(500).json({ error: 'Lỗi khi sửa sản phẩm.' });
      }
      const updatedProduct = { product_name, cost, quantity, brand_id, size_id, cate_id, imageUrl };
      res.status(200).json({ message: 'Sản phẩm đã được cập nhật thành công.', data: updatedProduct });
  });
});

// Endpoint xóa sản phẩm
router.delete('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const [result] = await db.execute('DELETE FROM products WHERE product_id = ?', [productId]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
});

module.exports = router;